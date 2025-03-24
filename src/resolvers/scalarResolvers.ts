import { GraphQLScalarType, Kind } from 'graphql'

export const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type',
  
  // Convert outgoing Date to ISO String
  serialize(value) {
    if (value instanceof Date) {
      return value.toISOString()
    } else if (typeof value === 'number') {
      return new Date(value).toISOString() // Handle timestamp numbers
    }
    return value
  },
  
  // Convert incoming string to Date
  parseValue(value) {
    if (typeof value === 'string') {
      return new Date(value)
    }
    return value
  },
  
  // Convert AST literal to Date
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
      return new Date(ast.value)
    }
    return null
  },
}) 