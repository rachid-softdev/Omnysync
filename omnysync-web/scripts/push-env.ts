/**
 * Push environment variables to Vercel
 * Run: pnpm run push-env [environment]
 */

import { execSync } from 'child_process'
import path from 'path'

const env = process.argv[2] || 'development'
const isProduction = env === 'prod' || env === 'production'

console.log(
  `🚀 Pushing ${isProduction ? 'production' : 'development'} environment variables to Vercel...`
)

try {
  execSync(`npx vercel env pull .env.${isProduction ? 'production' : 'development'} --yes`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  console.log('✅ Environment variables pushed successfully!')
} catch (error) {
  console.error('❌ Failed to push environment variables:', error)
  process.exit(1)
}
