import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true, strict: false });

export type CvEval = {
  technical_skills: number;
  experience_level: number;
  achievements: number;
  cultural_fit: number;
  notes?: string;
};

export type ProjectEval = {
  correctness: number;
  code_quality: number;
  resilience: number;
  documentation: number;
  creativity: number;
  notes?: string;
};

const cvEvalSchema = {
  type: 'object',
  required: ['technical_skills', 'experience_level', 'achievements', 'cultural_fit'],
  properties: {
    technical_skills: { type: 'integer', minimum: 1, maximum: 5 },
    experience_level: { type: 'integer', minimum: 1, maximum: 5 },
    achievements: { type: 'integer', minimum: 1, maximum: 5 },
    cultural_fit: { type: 'integer', minimum: 1, maximum: 5 },
    notes: { type: 'string' }
  },
  additionalProperties: true
};

const projectEvalSchema = {
  type: 'object',
  required: ['correctness', 'code_quality', 'resilience', 'documentation', 'creativity'],
  properties: {
    correctness: { type: 'integer', minimum: 1, maximum: 5 },
    code_quality: { type: 'integer', minimum: 1, maximum: 5 },
    resilience: { type: 'integer', minimum: 1, maximum: 5 },
    documentation: { type: 'integer', minimum: 1, maximum: 5 },
    creativity: { type: 'integer', minimum: 1, maximum: 5 },
    notes: { type: 'string' }
  },
  additionalProperties: true
};

export const validateCvEval = ajv.compile<CvEval>(cvEvalSchema);
export const validateProjectEval = ajv.compile<ProjectEval>(projectEvalSchema);