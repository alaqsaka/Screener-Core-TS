import fs from 'fs';
import path from 'path';
import jobDescription from './job_description.json'; 
import rubricSchema from './rubric.schema.json'; 
import rubricWeights from '../../rubric.json';

const caseStudyBrief = fs.readFileSync(path.join(__dirname, 'case_study_brief.txt'), 'utf-8');

export { jobDescription, rubricSchema, rubricWeights, caseStudyBrief };