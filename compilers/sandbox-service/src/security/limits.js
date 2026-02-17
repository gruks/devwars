import { config } from '../config/config.js';

/**
 * Get resource limits for container execution
 * @returns {Object} Docker resource limit configuration
 */
export function getResourceLimits() {
  return {
    Memory: config.MEMORY_LIMIT || '128m',
    NanoCpus: Math.floor((config.CPU_LIMIT || 0.5) * 1e9),
    NetworkMode: 'none',
    CapDrop: ['ALL'],
    Privileged: false,
    ReadonlyRootfs: true
  };
}

/**
 * Get security options for container
 * @returns {Array<string>} Docker security options
 */
export function containerSecurityOpts() {
  return [
    'no-new-privileges:true',
    'drop:ALL'
  ];
}

/**
 * Additional execution constraints
 */
export const EXECUTION_CONSTRAINTS = {
  maxOutputSize: 1024 * 1024, // 1MB
  maxExecutionTime: 5000, // 5 seconds
  allowedDirectories: ['/tmp'],
  restrictedSyscalls: [
    'mount', 'umount', 'chroot', 'pivot_root',
    'setuid', 'setgid', 'setns', 'unshare'
  ]
};
