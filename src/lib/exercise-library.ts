import type { Unit } from './types';

/** Body area an exercise is filed under in the picker. */
export type LibGroup = 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Forearms' | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Core' | 'Power' | 'Cardio';

export const LIB_GROUPS: LibGroup[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Power', 'Cardio'];

export interface LibExercise {
  name: string;
  group: LibGroup;
  /** Equipment, shown under the name. */
  kit: string;
  unit: Unit;
  scheme: string;
}

// [name, kit, unit, sets × reps]. Names match the Ranks lift keywords where a standard exists.
type Row = [string, string, Unit, string];
const RAW: Record<LibGroup, Row[]> = {
  Chest: [
    ['Bench press', 'Barbell', 'kg', '4 × 6'],
    ['Incline bench press', 'Barbell', 'kg', '3 × 8'],
    ['Incline dumbbell press', 'Dumbbells', 'kg', '3 × 8'],
    ['Flat dumbbell press', 'Dumbbells', 'kg', '3 × 8'],
    ['Chest press machine', 'Machine', 'kg', '3 × 10'],
    ['Incline chest press machine', 'Machine', 'kg', '3 × 10'],
    ['Smith machine incline press', 'Smith machine', 'kg', '3 × 8'],
    ['Pec deck fly machine', 'Machine', 'kg', '3 × 12'],
    ['Cable chest fly', 'Cable', 'kg', '3 × 12'],
    ['Low-to-high cable fly', 'Cable', 'kg', '3 × 12'],
    ['Dumbbell fly', 'Dumbbells', 'kg', '3 × 12'],
    ['Dips', 'Bodyweight', '+kg', '3 × 8'],
    ['Push-up', 'Bodyweight', null, '3 × 15'],
    ['Deficit push-up', 'Bodyweight', null, '3 × 12'],
  ],
  Back: [
    ['Pull-up', 'Bodyweight', '+kg', '4 × 6'],
    ['Chin-up', 'Bodyweight', '+kg', '3 × 8'],
    ['Lat pulldown', 'Cable', 'kg', '3 × 10'],
    ['Close-grip lat pulldown', 'Cable', 'kg', '3 × 10'],
    ['Single-arm lat pulldown', 'Cable', 'kg', '3 × 12'],
    ['Seated cable row', 'Cable', 'kg', '3 × 10'],
    ['Wide-grip cable row', 'Cable', 'kg', '3 × 10'],
    ['Barbell row', 'Barbell', 'kg', '4 × 8'],
    ['Pendlay row', 'Barbell', 'kg', '4 × 5'],
    ['Single-arm dumbbell row', 'Dumbbell', 'kg', '3 × 10'],
    ['Chest-supported row', 'Machine', 'kg', '3 × 10'],
    ['T-bar row', 'Machine', 'kg', '3 × 8'],
    ['Straight-arm pulldown', 'Cable', 'kg', '3 × 12'],
    ['Dumbbell pullover', 'Dumbbell', 'kg', '3 × 12'],
    ['Back extension', 'Bench', '+kg', '3 × 12'],
    ['Barbell shrug', 'Barbell', 'kg', '3 × 12'],
    ['Dumbbell shrug', 'Dumbbells', 'kg', '3 × 12'],
    ['Inverted row', 'Bodyweight', null, '3 × 10'],
  ],
  Shoulders: [
    ['Overhead press', 'Barbell', 'kg', '4 × 6'],
    ['Seated dumbbell shoulder press', 'Dumbbells', 'kg', '3 × 8'],
    ['Shoulder press machine', 'Machine', 'kg', '3 × 10'],
    ['Arnold press', 'Dumbbells', 'kg', '3 × 10'],
    ['Dumbbell lateral raise', 'Dumbbells', 'kg', '4 × 15'],
    ['Single-arm cable lateral raise', 'Cable', 'kg', '3 × 15'],
    ['Lateral raise machine', 'Machine', 'kg', '3 × 15'],
    ['Face pull', 'Cable', 'kg', '3 × 15'],
    ['Reverse pec deck', 'Machine', 'kg', '3 × 15'],
    ['Rear delt dumbbell fly', 'Dumbbells', 'kg', '3 × 15'],
    ['Front raise', 'Dumbbells', 'kg', '3 × 12'],
    ['Upright row', 'Cable', 'kg', '3 × 12'],
    ['Landmine press', 'Barbell', 'kg', '3 × 10'],
  ],
  Biceps: [
    ['EZ bar curl', 'EZ bar', 'kg', '3 × 10'],
    ['Barbell curl', 'Barbell', 'kg', '3 × 10'],
    ['Dumbbell curl', 'Dumbbells', 'kg', '3 × 10'],
    ['Incline dumbbell curl', 'Dumbbells', 'kg', '3 × 10'],
    ['Hammer curl', 'Dumbbells', 'kg', '3 × 12'],
    ['Preacher curl', 'Machine', 'kg', '3 × 10'],
    ['Bayesian cable curl', 'Cable', 'kg', '3 × 12'],
    ['Cable curl', 'Cable', 'kg', '3 × 12'],
    ['Concentration curl', 'Dumbbell', 'kg', '3 × 12'],
  ],
  Triceps: [
    ['Tricep pushdown', 'Cable', 'kg', '3 × 12'],
    ['Rope pushdown', 'Cable', 'kg', '3 × 12'],
    ['Overhead cable extension', 'Cable', 'kg', '3 × 12'],
    ['Skull crusher', 'EZ bar', 'kg', '3 × 10'],
    ['Close-grip bench press', 'Barbell', 'kg', '3 × 8'],
    ['Overhead dumbbell extension', 'Dumbbell', 'kg', '3 × 12'],
    ['Dip machine', 'Machine', 'kg', '3 × 10'],
    ['JM press', 'Smith machine', 'kg', '3 × 10'],
  ],
  Forearms: [
    ['Wrist curl', 'Dumbbells', 'kg', '3 × 15'],
    ['Reverse wrist curl', 'Dumbbells', 'kg', '3 × 15'],
    ['Reverse EZ bar curl', 'EZ bar', 'kg', '3 × 12'],
    ["Farmer's carry", 'Dumbbells', 'kg', '3 × 30 m'],
    ['Dead hang', 'Bar', null, '3 × 30 s'],
  ],
  Quads: [
    ['Back squat', 'Barbell', 'kg', '4 × 5'],
    ['Front squat', 'Barbell', 'kg', '4 × 5'],
    ['Hack squat', 'Machine', 'kg', '3 × 8'],
    ['Leg press', 'Machine', 'kg', '3 × 10'],
    ['Bulgarian split squat', 'Dumbbells', 'kg', '3 × 8'],
    ['Walking lunge', 'Dumbbells', 'kg', '3 × 10'],
    ['Reverse lunge', 'Dumbbells', 'kg', '3 × 10'],
    ['Leg extension', 'Machine', 'kg', '3 × 12'],
    ['Goblet squat', 'Dumbbell', 'kg', '3 × 10'],
    ['Step-up', 'Dumbbells', 'kg', '3 × 10'],
    ['Sissy squat', 'Bodyweight', null, '3 × 12'],
    ['Pendulum squat', 'Machine', 'kg', '3 × 8'],
  ],
  Hamstrings: [
    ['Deadlift', 'Barbell', 'kg', '3 × 5'],
    ['Paused deadlift', 'Barbell', 'kg', '3 × 3'],
    ['Romanian deadlift', 'Barbell', 'kg', '3 × 8'],
    ['Dumbbell Romanian deadlift', 'Dumbbells', 'kg', '3 × 10'],
    ['Stiff-leg deadlift', 'Barbell', 'kg', '3 × 8'],
    ['Seated leg curl', 'Machine', 'kg', '3 × 12'],
    ['Lying leg curl', 'Machine', 'kg', '3 × 12'],
    ['Nordic curl', 'Bodyweight', null, '3 × 6'],
    ['Good morning', 'Barbell', 'kg', '3 × 10'],
  ],
  Glutes: [
    ['Hip thrust', 'Barbell', 'kg', '3 × 10'],
    ['Hip thrust machine', 'Machine', 'kg', '3 × 10'],
    ['Glute bridge', 'Barbell', 'kg', '3 × 12'],
    ['Cable kickback', 'Cable', 'kg', '3 × 12'],
    ['Hip abduction machine', 'Machine', 'kg', '3 × 15'],
    ['Hip adduction machine', 'Machine', 'kg', '3 × 15'],
    ['Copenhagen plank', 'Bodyweight', null, '3 × 20 s'],
    ['Cossack squat', 'Bodyweight', null, '3 × 8'],
  ],
  Calves: [
    ['Standing calf raise', 'Machine', 'kg', '4 × 12'],
    ['Seated calf raise', 'Machine', 'kg', '4 × 12'],
    ['Leg press calf raise', 'Machine', 'kg', '3 × 15'],
    ['Single-leg calf raise', 'Bodyweight', '+kg', '3 × 12'],
    ['Tibialis raise', 'Bodyweight', null, '3 × 20'],
  ],
  Core: [
    ['Hanging leg raise', 'Bar', null, '3 × 12'],
    ['Cable crunch', 'Cable', 'kg', '3 × 15'],
    ['Ab wheel rollout', 'Ab wheel', null, '3 × 10'],
    ['Plank', 'Bodyweight', null, '3 × 45 s'],
    ['Side plank', 'Bodyweight', null, '3 × 30 s'],
    ['Pallof press', 'Cable', 'kg', '3 × 12'],
    ['Dead bug', 'Bodyweight', null, '3 × 10'],
    ['Russian twist', 'Plate', 'kg', '3 × 20'],
    ['Decline sit-up', 'Bench', '+kg', '3 × 12'],
    ['Suitcase carry', 'Dumbbell', 'kg', '3 × 30 m'],
  ],
  Power: [
    ['Power clean', 'Barbell', 'kg', '5 × 3'],
    ['Hang clean', 'Barbell', 'kg', '5 × 3'],
    ['Push press', 'Barbell', 'kg', '4 × 5'],
    ['Box jump', 'Box', 'cm', '4 × 3'],
    ['Broad jump', 'Bodyweight', 'cm', '4 × 3'],
    ['Lateral bound', 'Bodyweight', null, '3 × 6'],
    ['Medicine ball slam', 'Medicine ball', 'kg', '3 × 8'],
    ['Medicine ball rotational throw', 'Medicine ball', 'kg', '3 × 6'],
    ['Kettlebell swing', 'Kettlebell', 'kg', '3 × 15'],
    ['Trap bar jump', 'Trap bar', 'kg', '4 × 3'],
  ],
  Cardio: [
    ['Incline treadmill walk', 'Treadmill', null, '1 × 20 min'],
    ['Stationary bike', 'Bike', null, '1 × 20 min'],
    ['Rowing machine', 'Rower', null, '1 × 10 min'],
    ['Stair climber', 'Machine', null, '1 × 15 min'],
    ['Jump rope', 'Rope', null, '5 × 1 min'],
    ['Sled push', 'Sled', 'kg', '4 × 20 m'],
  ],
};

export const LIBRARY: LibExercise[] = LIB_GROUPS.flatMap((group) =>
  RAW[group].map(([name, kit, unit, scheme]) => ({ name, group, kit, unit, scheme })),
);

/** Sets count from a scheme like "4 × 8". */
export function setsOf(scheme: string) {
  const m = scheme.match(/^(\d+)\s*[×x]/);
  return m ? Math.max(1, Math.min(12, +m[1])) : 3;
}
