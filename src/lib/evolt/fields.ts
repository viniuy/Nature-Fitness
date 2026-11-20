import type { BoxField } from './layout';

export type EvoltField = BoxField | 'bioAge' | 'bwiScore';

export interface FieldInfo {
  key: EvoltField;
  label: string;
  unit?: string;
}

/** Fields in the order and groups the Evolt Result Sheet shows them. */
export const EVOLT_GROUPS: { title: string; fields: FieldInfo[] }[] = [
  {
    title: 'Scan',
    fields: [
      { key: 'height', label: 'Height', unit: 'cm' },
      { key: 'weight', label: 'Weight', unit: 'kg' },
      { key: 'age', label: 'Age', unit: 'yrs' },
    ],
  },
  {
    title: 'Body composition',
    fields: [
      { key: 'leanBodyMass', label: 'Lean body mass', unit: 'kg' },
      { key: 'skeletalMuscleMass', label: 'Skeletal muscle mass', unit: 'kg' },
      { key: 'protein', label: 'Protein', unit: 'kg' },
      { key: 'mineral', label: 'Mineral', unit: 'kg' },
      { key: 'totalBodyWater', label: 'Total body water', unit: 'kg' },
      { key: 'bodyFatMass', label: 'Body fat mass', unit: 'kg' },
      { key: 'subcutaneousFatMass', label: 'Subcutaneous fat mass', unit: 'kg' },
      { key: 'visceralFatMass', label: 'Visceral fat mass', unit: 'kg' },
      { key: 'visceralFatArea', label: 'Visceral fat area', unit: 'cm²' },
      { key: 'bodyFatPercent', label: 'Body fat', unit: '%' },
      { key: 'visceralFatLevel', label: 'Visceral fat level' },
      { key: 'icf', label: 'Intracellular fluid', unit: 'kg' },
      { key: 'ecf', label: 'Extracellular fluid', unit: 'kg' },
      { key: 'bmr', label: 'BMR', unit: 'kcal' },
      { key: 'tee', label: 'TEE', unit: 'kcal' },
      { key: 'bioAge', label: 'Bio age', unit: 'yrs' },
      { key: 'bwiScore', label: 'BWI score', unit: '/10' },
    ],
  },
  {
    title: 'Segmental',
    fields: [
      { key: 'leftArmLean', label: 'Left arm lean', unit: 'kg' },
      { key: 'leftArmFat', label: 'Left arm fat', unit: 'kg' },
      { key: 'rightArmLean', label: 'Right arm lean', unit: 'kg' },
      { key: 'rightArmFat', label: 'Right arm fat', unit: 'kg' },
      { key: 'torsoLean', label: 'Torso lean', unit: 'kg' },
      { key: 'torsoFat', label: 'Torso fat', unit: 'kg' },
      { key: 'leftLegLean', label: 'Left leg lean', unit: 'kg' },
      { key: 'leftLegFat', label: 'Left leg fat', unit: 'kg' },
      { key: 'rightLegLean', label: 'Right leg lean', unit: 'kg' },
      { key: 'rightLegFat', label: 'Right leg fat', unit: 'kg' },
      { key: 'abdominalCircumference', label: 'Abdominal circumference', unit: 'cm' },
      { key: 'waistToHip', label: 'Waist to hip ratio' },
    ],
  },
  {
    title: 'Nutrition targets',
    fields: [
      { key: 'calories', label: 'Calories', unit: 'kcal' },
      { key: 'proteinTarget', label: 'Protein', unit: 'g' },
      { key: 'carbTarget', label: 'Carbs', unit: 'g' },
      { key: 'fatTarget', label: 'Fat', unit: 'g' },
    ],
  },
];

export const EVOLT_FIELDS: FieldInfo[] = EVOLT_GROUPS.flatMap((g) => g.fields);
export const FIELD_INFO = Object.fromEntries(EVOLT_FIELDS.map((f) => [f.key, f])) as Record<EvoltField, FieldInfo>;
