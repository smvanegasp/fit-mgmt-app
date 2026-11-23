"""The target game: +1 for a session that reaches the target, -1 for a miss, 3 means go up."""

from app.history import best_drop, goes_up, progression, rung, written_target
from app.models import Entry


def lift(sets: list[tuple[int, int, float]], targets: list[str] | None = None) -> Entry:
    """[(count, reps, weight)] -> an Entry, optionally with written targets."""
    return Entry(exerciseId="squat", sets=[{"reps": r, "weightLb": w} for n, r, w in sets for _ in range(n)],
                 targets=[{"text": t} for t in targets or []])


def game(*entries: Entry) -> tuple[list[float], float | None, int]:
    streak = progression([(f"2026-10-{10 + i:02d}", e) for i, e in enumerate(entries)])
    assert streak is not None
    return streak.scheme.sets, streak.scheme.weightLb, streak.times


def test_a_miss_takes_one_away_instead_of_resetting() -> None:
    target = lift([(4, 4, 115)])
    miss = lift([(3, 4, 115), (1, 3, 115)])
    assert game(target, target, miss) == ([4, 4, 4, 4], 115, 1)
    assert game(target, miss, miss) == ([4, 4, 4, 4], 115, 0)


def test_more_weight_or_a_deload_starts_a_new_target() -> None:
    assert game(lift([(5, 5, 170)]), lift([(5, 5, 170)]), lift([(5, 5, 175)])) == ([5] * 5, 175, 1)
    assert game(lift([(3, 3, 190)]), lift([(4, 3, 185)])) == ([3] * 4, 185, 1)


def test_a_higher_rung_is_the_next_target() -> None:
    base = lift([(5, 3, 180)])
    assert game(base, base, base, lift([(5, 4, 180)])) == ([4] * 5, 180, 1)
    # At any count (progressive overload, Sergio 2026-11-14).
    assert game(base, lift([(5, 4, 180)])) == ([4] * 5, 180, 1)
    # Then falling short of the new target is a miss (the pull-ups: 4x4, then 4-4-4-3).
    assert game(base, lift([(4, 4, 180)]), lift([(3, 4, 180), (1, 3, 180)])) == ([4] * 4, 180, 0)


def test_a_much_lighter_session_plays_its_own_target() -> None:
    heavy = lift([(5, 4, 180)])
    second = lift([(3, 6, 155)])  # more than 10% lighter: squat done second, after deadlift
    sessions = [(f"2026-10-{10 + i:02d}", e) for i, e in enumerate([heavy, heavy, second, second])]
    roles = ["first", "first", "later", "later"]
    main = progression(sessions, roles, "first")
    assert (main.scheme.sets, main.scheme.weightLb, main.times) == ([4] * 5, 180, 2)
    later = progression(sessions, roles, "later")
    assert (later.scheme.sets, later.scheme.weightLb, later.times) == ([6] * 3, 155, 2)
    # Never done second yet: the main target.
    assert progression(sessions[:2], roles[:2], "later").scheme.weightLb == 180


def test_volume_sets_after_the_heavy_ones_are_ignored() -> None:
    assert game(lift([(5, 4, 180), (3, 8, 150)]), lift([(5, 4, 180), (2, 8, 150)])) == ([4] * 5, 180, 2)


def test_mixed_reps_reach_by_total() -> None:
    # 3x4 + 1x3 = 15 reps; 4x4 + 3 = 15 in other sets reaches it.
    assert game(lift([(3, 4, 90), (1, 3, 90)]), lift([(2, 4, 90), (1, 3, 90), (1, 4, 90)])) == ([4, 4, 4, 3], 90, 2)


def test_written_targets_from_the_log_are_the_truth() -> None:
    # The log says "done twice" before this session; the session reaches it: 3.
    assert game(lift([(4, 3, 190)], ["4x3 190 lbs 2 veces"])) == ([3] * 4, 190, 3)
    # A written target for other (lighter) sets is not this one.
    assert game(lift([(5, 4, 180)]), lift([(5, 4, 180), (3, 8, 150)], ["antes 3 vez 3x8 150 lbs"])) == ([4] * 5, 180, 2)


def test_reading_written_targets() -> None:
    scheme, times, weight = written_target("antes 180 5x4 1 vez")
    assert (scheme.sets, times, weight) == ([4] * 5, 1, 180)
    scheme, times, weight = written_target("1 vez 3x4 1x3 90 lbs")
    assert (scheme.sets, times, weight) == ([4, 4, 4, 3], 1, 90)
    assert written_target("3x7 vez") is None  # "7 vez" is the reps, not a count
    assert written_target("antes 3x4") is None


def test_best_drop_set_is_the_most_total_reps() -> None:
    def ladder(*reps: int) -> Entry:
        return Entry(exerciseId="dips", sets=[{"reps": 4, "weightLb": 115}] + [
            {"reps": r, "weightLb": w, "drop": True} for r, w in zip(reps, [90, 70, 45, 25, 0])])
    best = best_drop([("2026-10-08", ladder(4, 5, 4, 7, 10)), ("2026-10-22", ladder(4, 5, 8, 8, 18)),
                      ("2026-10-29", ladder(4, 4, 5, 6, 11))])
    assert best.date == "2026-10-22" and [s.reps for s in best.sets] == [4, 5, 8, 8, 18]
    assert best_drop([("2026-10-01", Entry(exerciseId="squat", sets=[{"reps": 5, "weightLb": 170}]))]) is None


def test_going_up_follows_the_ladder() -> None:
    # Sergio's ladder: 3x2, 4x2, 5x2, 3x3, ... 4x5, 5x5. One more rep per set with fewer sets is up.
    assert goes_up([5, 5, 5], [4] * 5)  # 5x4 -> 3x5
    assert goes_up([4] * 4, [4, 4, 4, 3])  # 3x4 + 1x3 -> 4x4
    assert goes_up([5, 5, 5, 4], [4] * 4)  # three sets of 5 is 3x5, above 4x4
    assert not goes_up([5, 4, 4, 4], [4] * 4)  # one set of 5 isn't a rung
    assert not goes_up([4] * 4, [5, 5, 5])  # 4x4 is below 3x5, more reps or not
    assert not goes_up([9, 8], [8, 8])
    assert rung([5, 5, 5, 4], 3) == (5, 3)


def test_three_by_five_after_five_by_four_is_the_new_target() -> None:
    five_by_four = lift([(5, 4, 180)])
    assert game(five_by_four, five_by_four, lift([(3, 5, 180)])) == ([5] * 3, 180, 1)


def test_a_target_not_reached_in_two_months_gives_way() -> None:
    # An old drop set read as straight sets (wide pull-ups): every session after it missed.
    old = Entry(exerciseId="wide-pull-ups", sets=[{"reps": r} for r in (8, 10, 12, 7)])
    now = Entry(exerciseId="wide-pull-ups", sets=[{"reps": 8}] * 3)  # the same rung, fewer reps
    early = progression([("2026-01-01", old), ("2026-02-01", now)])
    assert (early.scheme.sets, early.times) == ([8, 10, 12, 7], 0)
    late = progression([("2026-01-01", old), ("2026-02-01", now), ("2026-03-15", now)])
    assert (late.scheme.sets, late.times) == ([8, 8, 8], 1)
    # Reached after a long break still counts.
    back = progression([("2026-01-01", now), ("2026-01-08", now), ("2026-05-01", now)])
    assert (back.scheme.sets, back.times) == ([8, 8, 8], 3)
