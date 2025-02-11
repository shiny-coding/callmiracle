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

export type ConnectionParams = {
  __typename?: 'ConnectionParams';
  answer?: Maybe<Scalars['String']['output']>;
  audioEnabled?: Maybe<Scalars['Boolean']['output']>;
  iceCandidate?: Maybe<Scalars['String']['output']>;
  initiatorUserId: Scalars['ID']['output'];
  offer?: Maybe<Scalars['String']['output']>;
  targetUserId: Scalars['ID']['output'];
  type: Scalars['String']['output'];
  videoEnabled?: Maybe<Scalars['Boolean']['output']>;
};

export type ConnectionParamsInput = {
  answer?: InputMaybe<Scalars['String']['input']>;
  audioEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  iceCandidate?: InputMaybe<Scalars['String']['input']>;
  initiatorUserId: Scalars['ID']['input'];
  offer?: InputMaybe<Scalars['String']['input']>;
  targetUserId: Scalars['ID']['input'];
  type: Scalars['String']['input'];
  videoEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ConnectionRequest = {
  __typename?: 'ConnectionRequest';
  answer?: Maybe<Scalars['String']['output']>;
  audioEnabled?: Maybe<Scalars['Boolean']['output']>;
  from: User;
  iceCandidate?: Maybe<Scalars['String']['output']>;
  offer?: Maybe<Scalars['String']['output']>;
  quality?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
  videoEnabled?: Maybe<Scalars['Boolean']['output']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  connectWithUser?: Maybe<ConnectionParams>;
  updateUser?: Maybe<User>;
};


export type MutationConnectWithUserArgs = {
  input: ConnectionParamsInput;
};


export type MutationUpdateUserArgs = {
  input: UpdateUserInput;
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

export type Subscription = {
  __typename?: 'Subscription';
  onConnectionRequest?: Maybe<ConnectionRequest>;
  onUsersUpdated: Array<User>;
};


export type SubscriptionOnConnectionRequestArgs = {
  userId: Scalars['ID']['input'];
};

export type UpdateUserInput = {
  languages: Array<Scalars['String']['input']>;
  locale: Scalars['String']['input'];
  name: Scalars['String']['input'];
  online: Scalars['Boolean']['input'];
  statuses: Array<Status>;
  userId: Scalars['ID']['input'];
};

export type User = {
  __typename?: 'User';
  languages: Array<Scalars['String']['output']>;
  locale: Scalars['String']['output'];
  name: Scalars['String']['output'];
  online: Scalars['Boolean']['output'];
  statuses: Array<Status>;
  timestamp: Scalars['Float']['output'];
  userId: Scalars['ID']['output'];
};
