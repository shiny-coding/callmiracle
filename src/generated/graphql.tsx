export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Mutation = {
  __typename?: 'Mutation';
  connect?: Maybe<User>;
};


export type MutationConnectArgs = {
  name: Scalars['String']['input'];
  statuses: Array<Status>;
  userId: Scalars['String']['input'];
};

export type Query = {
  __typename?: 'Query';
  users: Array<User>;
};

export enum Status {
  Chat = 'CHAT',
  MeetNewPeople = 'MEET_NEW_PEOPLE',
  NeedHelpWithSituation = 'NEED_HELP_WITH_SITUATION',
  SitTogetherInSilence = 'SIT_TOGETHER_IN_SILENCE',
  WantToHelpWithSituation = 'WANT_TO_HELP_WITH_SITUATION',
  WantToListen = 'WANT_TO_LISTEN',
  WantToSpeakOut = 'WANT_TO_SPEAK_OUT'
}

export type User = {
  __typename?: 'User';
  name: Scalars['String']['output'];
  statuses: Array<Status>;
  timestamp: Scalars['String']['output'];
  userId: Scalars['String']['output'];
};
