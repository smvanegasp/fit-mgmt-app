"""The target game: +1 for a session that reaches the target, -1 for a miss, 3 means go up."""

from app.history import best_drop, progression, written_target
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


def test_after_three_times_more_reps_is_the_next_target() -> None:
    base = lift([(5, 3, 180)])
    assert game(base, base, base, lift([(5, 4, 180)])) == ([4] * 5, 180, 1)
    # Before three, doing more still just counts as reaching it.
    assert game(base, lift([(5, 4, 180)])) == ([3] * 5, 180, 2)


def test_light_days_do_not_count() -> None:
    heavy = lift([(5, 4, 180)])
    volume_only = lift([(3, 6, 155)])  # more than 10% lighter
    assert game(heavy, heavy, volume_only) == ([4] * 5, 180, 2)


def test_volume_sets_after_the_heavy_ones_are_ignored() -> None:
    assert game(lift([(5, 4, 180), (3, 8, 150)]), lift([(5, 4, 180), (2, 8, 150)])) == ([4] * 5, 180, 2)


def test_mixed_reps_reach_by_total() -> None:
    # 3x4 + 1x3 = 15 reps; 4x4 = 16 reaches it.
    assert game(lift([(3, 4, 90), (1, 3, 90)]), lift([(4, 4, 90)])) == ([4, 4, 4, 3], 90, 2)


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
