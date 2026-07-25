// Mock data for development/testing without a database

export const mockUsers = [
  {
    id: 'user-1',
    email: 'admin@pgurukul.com',
    username: 'admin',
    fullName: 'Administrator',
    role: 'super_admin',
    departmentId: 'dept-1',
    avatarUrl: '',
    password: 'password123',
  },
  {
    id: 'user-2',
    email: 'lead@pgurukul.com',
    username: 'deptlead',
    fullName: 'Department Lead',
    role: 'department_lead',
    departmentId: 'dept-1',
    avatarUrl: '',
    password: 'password123',
  },
  {
    id: 'user-3',
    email: 'intern@pgurukul.com',
    username: 'intern',
    fullName: 'Intern User',
    role: 'intern',
    departmentId: 'dept-1',
    avatarUrl: '',
    password: 'password123',
  },
];

export const mockDepartments = [
  {
    id: 'dept-1',
    name: 'Computer Science',
    description: 'Department of Computer Science and Engineering',
    inviteCode: 'CS2024',
    createdBy: 'user-1',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'dept-2',
    name: 'Mechanical Engineering',
    description: 'Department of Mechanical Engineering',
    inviteCode: 'ME2024',
    createdBy: 'user-1',
    createdAt: new Date('2024-01-02'),
  },
];

export const mockMessages = [
  {
    id: 'msg-1',
    content: 'Welcome to the PGURUKUL chat system!',
    senderId: 'user-1',
    departmentId: 'dept-1',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    parentId: null,
  },
  {
    id: 'msg-2',
    content: 'This is a test message from the department lead.',
    senderId: 'user-2',
    departmentId: 'dept-1',
    createdAt: new Date('2024-01-15T01:00:00'),
    updatedAt: new Date('2024-01-15T01:00:00'),
    parentId: null,
  },
];

export const mockTasks = [
  {
    id: 'task-1',
    title: 'Setup Development Environment',
    description: 'Set up local development environment for the project',
    status: 'in_progress',
    priority: 'high',
    departmentId: 'dept-1',
    assigneeId: 'user-3',
    dueDate: new Date('2024-02-01'),
    createdBy: 'user-2',
    createdAt: new Date('2024-01-10'),
  },
  {
    id: 'task-2',
    title: 'Complete API Documentation',
    description: 'Document all API endpoints and their usage',
    status: 'not_started',
    priority: 'medium',
    departmentId: 'dept-1',
    assigneeId: 'user-2',
    dueDate: new Date('2024-02-15'),
    createdBy: 'user-1',
    createdAt: new Date('2024-01-12'),
  },
];

export const mockAnnouncements = [
  {
    id: 'ann-1',
    title: 'Welcome to PGURUKUL',
    content: 'Welcome to the new collaboration platform. This is a global announcement visible to all users.',
    scope: 'global',
    departmentId: null,
    createdBy: 'user-1',
    isPinned: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'ann-2',
    title: 'Department Meeting Tomorrow',
    content: 'We will have a department meeting tomorrow at 2 PM to discuss project progress.',
    scope: 'department',
    departmentId: 'dept-1',
    createdBy: 'user-2',
    isPinned: false,
    createdAt: new Date('2024-01-15'),
  },
];
