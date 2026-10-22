import { selfTestDrive } from './drive.js'

const errors = selfTestDrive()
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('drive self-test passed')
