// Vercel project config (typed). Picked up automatically by Vercel.
// docs: https://vercel.com/docs/project-configuration/vercel-ts
//
// Right now we only declare the framework so previews/prod deploys pick the
// correct build pipeline. Rewrites/headers/crons land in the deploy-and-readme
// subgoal when public URLs go live.

export const config = {
  framework: 'nextjs' as const,
  buildCommand: 'npm run build',
  installCommand: 'npm install',
  outputDirectory: '.next',
};

export default config;
