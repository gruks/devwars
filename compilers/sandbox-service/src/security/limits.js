import { config } from '../config/config.js';

/**
 * Get resource limits for container execution
 * @returns {Object} Docker resource limit configuration
 */
function parseMemoryToBytes(memStr) {
  if (!memStr) return 128 * 1024 * 1024;
  const match = memStr.match(/^(\d+)([kmg]?)$/i);
  if (!match) return 128 * 1024 * 1024;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'k': return value * 1024;
    case 'm': return value * 1024 * 1024;
    case 'g': return value * 1024 * 1024 * 1024;
    default: return value;
  }
}

export function getResourceLimits() {
  return {
    Memory: parseMemoryToBytes(config.MEMORY_LIMIT),
    NanoCpus: Math.floor((config.CPU_LIMIT || 0.5) * 1e9),
    NetworkMode: 'none',
    CapDrop: ['ALL'],
    Privileged: false,
    ReadonlyRootfs: false
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
