export const seccompProfile = {
  defaultAction: 'SCMP_ACT_ERRNO',
  architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_X86', 'SCMP_ARCH_X32'],
  syscalls: [
    {
      names: [
        'accept', 'accept4', 'access', 'arch_prctl', 'bind', 'brk',
        'chmod', 'chown', 'clock_getres', 'clock_gettime', 'clock_nanosleep',
        'close', 'connect', 'dup', 'dup2', 'dup3', 'epoll_create', 'epoll_create1',
        'epoll_ctl', 'epoll_pwait', 'epoll_wait', 'eventfd', 'eventfd2',
        'execve', 'exit', 'exit_group', 'faccessat', 'fadvise64', 'fallocate',
        'fchdir', 'fchmod', 'fchmodat', 'fchown', 'fchownat', 'fcntl',
        'fdatasync', 'flock', 'fstat', 'fstatfs', 'fsync', 'ftruncate',
        'futex', 'getcwd', 'getdents', 'getdents64', 'getegid', 'geteuid',
        'getgid', 'getgroups', 'getitimer', 'getpeername', 'getpgid', 'getpgrp',
        'getpid', 'getppid', 'getpriority', 'getrandom', 'getresgid', 'getresuid',
        'getrlimit', 'getrusage', 'getsid', 'getsockname', 'getsockopt',
        'gettid', 'gettimeofday', 'getuid', 'getxattr', 'inotify_add_watch',
        'inotify_init', 'inotify_init1', 'inotify_rm_watch', 'io_cancel',
        'ioctl', 'io_destroy', 'io_getevents', 'ioprio_get', 'ioprio_set',
        'io_setup', 'io_submit', 'lchown', 'lgetxattr', 'link', 'linkat',
        'listen', 'listxattr', 'llistxattr', 'lseek', 'lstat', 'madvise',
        'memfd_create', 'mkdir', 'mkdirat', 'mmap', 'mprotect', 'mremap',
        'munmap', 'nanosleep', 'newfstatat', 'open', 'openat', 'pause',
        'pipe', 'pipe2', 'poll', 'ppoll', 'prctl', 'pread64', 'preadv',
        'prlimit64', 'pselect6', 'pwrite64', 'pwritev', 'read', 'readlink',
        'readlinkat', 'readv', 'recvfrom', 'recvmmsg', 'recvmsg', 'rename',
        'renameat', 'renameat2', 'restart_syscall', 'rmdir', 'rt_sigaction',
        'rt_sigpending', 'rt_sigprocmask', 'rt_sigqueueinfo', 'rt_sigreturn',
        'rt_sigsuspend', 'rt_sigtimedwait', 'sched_getaffinity', 'sched_getattr',
        'sched_getparam', 'sched_get_priority_max', 'sched_get_priority_min',
        'sched_getscheduler', 'sched_setaffinity', 'sched_setattr', 'sched_setparam',
        'sched_setscheduler', 'sched_yield', 'seccomp', 'select', 'semctl',
        'semget', 'semop', 'semtimedop', 'sendfile', 'sendmmsg', 'sendmsg',
        'sendto', 'setfsgid', 'setfsuid', 'setgid', 'setgroups', 'setitimer',
        'setpgid', 'setpriority', 'setregid', 'setresgid', 'setresuid',
        'setreuid', 'setrlimit', 'setsid', 'setsockopt', 'set_tid_address',
        'setuid', 'setxattr', 'shmat', 'shmctl', 'shmdt', 'shmget',
        'shutdown', 'sigaltstack', 'socket', 'socketpair', 'splice',
        'stat', 'statfs', 'symlink', 'symlinkat', 'sync', 'sync_file_range',
        'syncfs', 'sysinfo', 'tee', 'tgkill', 'time', 'timer_create',
        'timer_delete', 'timerfd_create', 'timerfd_gettime', 'timerfd_settime',
        'timer_getoverrun', 'timer_gettime', 'timer_settime', 'times',
        'tkill', 'truncate', 'umask', 'uname', 'unlink', 'unlinkat',
        'utime', 'utimensat', 'utimes', 'vfork', 'wait4', 'waitid',
        'write', 'writev'
      ],
      action: 'SCMP_ACT_ALLOW'
    }
  ]
};

export const containerSecurityOpts = [
  'no-new-privileges:true',
  'seccomp=default',
  'apparmor=docker-default'
];

export const getResourceLimits = (config) => ({
  Memory: parseMemoryLimit(config.MEMORY_LIMIT),
  MemorySwap: parseMemoryLimit(config.MEMORY_LIMIT),
  NanoCpus: config.CPU_LIMIT * 1e9,
  PidsLimit: 64,
  Ulimits: [
    { Name: 'nofile', Soft: 256, Hard: 512 },
    { Name: 'nproc', Soft: 32, Hard: 64 }
  ]
});

function parseMemoryLimit(limit) {
  const units = { k: 1024, m: 1024 ** 2, g: 1024 ** 3 };
  const match = limit.toLowerCase().match(/^(\d+)([kmg])$/);
  if (!match) return 128 * 1024 * 1024;
  return parseInt(match[1]) * units[match[2]];
}