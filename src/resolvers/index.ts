const users = [
  { name: 'Alice', ip: '192.168.1.1', status: ['active', 'online'] },
  { name: 'Bob', ip: '192.168.1.2', status: ['inactive'] },
];

export const resolvers = {
  Query: {
    users: () => users,
  },
}; 