import { beforeAll } from 'vitest'

// Les tests d'intégration nécessitent une DB PostgreSQL dédiée
// On utilise la variable d'env TEST_DATABASE_URL
// Si non définie, les tests sont skip avec un message

beforeAll(() => {
  if (!process.env.TEST_DATABASE_URL) {
    console.warn('⚠ TEST_DATABASE_URL not set — integration tests will be skipped')
  }
})
