import weights from '../../rubric.json';

type CvEvalIn = {
  technical_skills: number;
  experience_level: number;
  achievements: number;
  cultural_fit: number;
};

type ProjectEvalIn = {
  correctness: number;
  code_quality: number;
  resilience: number;
  documentation: number;
  creativity: number;
};

export function computeCvMatchRate(cv: CvEvalIn): number {
  const w = weights as any;
  const score =
    cv.technical_skills * (w.technical?.weight ?? 0.4) +
    cv.experience_level * (w.experience?.weight ?? 0.25) +
    cv.achievements * (w.achievements?.weight ?? 0.2) +
    cv.cultural_fit * (w.cultural?.weight ?? 0.15);
  return Math.round(((score / 5) * 100) * 10) / 10;
}

export function computeProjectScore(p: ProjectEvalIn): number {
  const w = (weights as any).project || {};
  const weighted =
    p.correctness * (w.correctness ?? 0.3) +
    p.code_quality * (w.code_quality ?? 0.25) +
    p.resilience * (w.resilience ?? 0.2) +
    p.documentation * (w.documentation ?? 0.15) +
    p.creativity * (w.creativity ?? 0.1);
  const out = (weighted / 5) * 10;
  return Math.round(out * 10) / 10;
}