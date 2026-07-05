import { describe, expect, it } from 'vitest';
import { SetupService } from '../../core/setup/SetupService';

describe('SetupService requirements', () => {
  it('reports missing requirements shape', async () => {
    const requirements = await SetupService.getSetupRequirements();
    expect(Array.isArray(requirements)).toBe(true);
    for (const item of requirements) {
      expect(typeof item).toBe('string');
    }
  });

  it('returns status with step flags', async () => {
    const status = await SetupService.getStatus();
    expect(status).toMatchObject({
      completed: expect.any(Boolean),
      steps: {
        instance: expect.any(Boolean),
        authConnector: expect.any(Boolean),
        studentDataConnector: expect.any(Boolean),
        modules: expect.any(Boolean),
        admin: expect.any(Boolean),
      },
    });
  });
});
