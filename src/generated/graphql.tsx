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
  Date: { input: any; output: any; }
};

export type Block = {
  __typename?: 'Block';
  all: Scalars['Boolean']['output'];
  interestsBlocks: Array<InterestsBlock>;
  userId: Scalars['ID']['output'];
};

export type BlockInput = {
  all: Scalars['Boolean']['input'];
  interestsBlocks: Array<InterestsBlockInput>;
  userId: Scalars['ID']['input'];
};

export type BroadcastEvent = {
  __typename?: 'BroadcastEvent';
  type: BroadcastType;
};

export enum BroadcastType {
  MeetingUpdated = 'MEETING_UPDATED'
}

export type Call = {
  __typename?: 'Call';
  _id: Scalars['ID']['output'];
  durationS: Scalars['Int']['output'];
  initiatorUserId: Scalars['ID']['output'];
  meetingId?: Maybe<Scalars['ID']['output']>;
  targetUserId: Scalars['ID']['output'];
  type: Scalars['String']['output'];
};

export type CallEvent = {
  __typename?: 'CallEvent';
  answer?: Maybe<Scalars['String']['output']>;
  audioEnabled?: Maybe<Scalars['Boolean']['output']>;
  callId?: Maybe<Scalars['ID']['output']>;
  from: User;
  iceCandidate?: Maybe<Scalars['String']['output']>;
  meetingId?: Maybe<Scalars['ID']['output']>;
  meetingLastCallTime?: Maybe<Scalars['Float']['output']>;
  offer?: Maybe<Scalars['String']['output']>;
  quality?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
  videoEnabled?: Maybe<Scalars['Boolean']['output']>;
};

export type CallHistoryEntry = {
  __typename?: 'CallHistoryEntry';
  durationS: Scalars['Int']['output'];
  lastCallAt: Scalars['Float']['output'];
  totalCalls: Scalars['Int']['output'];
  user: User;
};

export type CallUserInput = {
  answer?: InputMaybe<Scalars['String']['input']>;
  audioEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  callId?: InputMaybe<Scalars['ID']['input']>;
  iceCandidate?: InputMaybe<Scalars['String']['input']>;
  initiatorUserId: Scalars['ID']['input'];
  meetingId?: InputMaybe<Scalars['ID']['input']>;
  meetingLastCallTime?: InputMaybe<Scalars['Float']['input']>;
  offer?: InputMaybe<Scalars['String']['input']>;
  quality?: InputMaybe<Scalars['String']['input']>;
  targetUserId: Scalars['ID']['input'];
  type: Scalars['String']['input'];
  videoEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type DeleteMeetingResponse = {
  __typename?: 'DeleteMeetingResponse';
  _id: Scalars['ID']['output'];
};

export type Group = {
  __typename?: 'Group';
  _id: Scalars['ID']['output'];
  admins: Array<Scalars['ID']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  interestsDescriptions: Array<InterestDescription>;
  interestsPairs: Array<Array<Scalars['String']['output']>>;
  joinToken?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  open: Scalars['Boolean']['output'];
  owner: Scalars['ID']['output'];
  transparency: GroupTransparency;
  usersCount?: Maybe<Scalars['Int']['output']>;
};

export type GroupInput = {
  _id?: InputMaybe<Scalars['ID']['input']>;
  admins: Array<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  interestsDescriptions: Array<InterestDescriptionInput>;
  interestsPairs: Array<Array<Scalars['String']['input']>>;
  name: Scalars['String']['input'];
  open: Scalars['Boolean']['input'];
  transparency: GroupTransparency;
};

export enum GroupTransparency {
  Mixed = 'MIXED',
  Opaque = 'OPAQUE',
  Transparent = 'TRANSPARENT'
}

export type InterestDescription = {
  __typename?: 'InterestDescription';
  description: Scalars['String']['output'];
  interest: Scalars['String']['output'];
};

export type InterestDescriptionInput = {
  description: Scalars['String']['input'];
  interest: Scalars['String']['input'];
};

export type InterestsBlock = {
  __typename?: 'InterestsBlock';
  all: Scalars['Boolean']['output'];
  groupId: Scalars['ID']['output'];
  interests: Array<Scalars['String']['output']>;
};

export type InterestsBlockInput = {
  all: Scalars['Boolean']['input'];
  groupId: Scalars['ID']['input'];
  interests: Array<Scalars['String']['input']>;
};

export type Meeting = {
  __typename?: 'Meeting';
  _id: Scalars['ID']['output'];
  allowedFemales: Scalars['Boolean']['output'];
  allowedMales: Scalars['Boolean']['output'];
  allowedMaxAge: Scalars['Int']['output'];
  allowedMinAge: Scalars['Int']['output'];
  createdAt?: Maybe<Scalars['Date']['output']>;
  groupId: Scalars['ID']['output'];
  interests: Array<Scalars['String']['output']>;
  languages: Array<Scalars['String']['output']>;
  lastCallTime?: Maybe<Scalars['Float']['output']>;
  lastMissedCallTime?: Maybe<Scalars['Float']['output']>;
  lastSlotEnd: Scalars['Float']['output'];
  linkedToPeer?: Maybe<Scalars['Boolean']['output']>;
  minDurationM: Scalars['Int']['output'];
  peerMeetingId?: Maybe<Scalars['String']['output']>;
  preferEarlier: Scalars['Boolean']['output'];
  startTime?: Maybe<Scalars['Float']['output']>;
  status: MeetingStatus;
  timeSlots: Array<Scalars['Float']['output']>;
  totalDurationS?: Maybe<Scalars['Int']['output']>;
  userId: Scalars['ID']['output'];
  userName?: Maybe<Scalars['String']['output']>;
};

export type MeetingInput = {
  _id?: InputMaybe<Scalars['ID']['input']>;
  allowedFemales: Scalars['Boolean']['input'];
  allowedMales: Scalars['Boolean']['input'];
  allowedMaxAge: Scalars['Int']['input'];
  allowedMinAge: Scalars['Int']['input'];
  groupId: Scalars['ID']['input'];
  interests: Array<Scalars['String']['input']>;
  languages: Array<Scalars['String']['input']>;
  meetingToConnectId?: InputMaybe<Scalars['ID']['input']>;
  minDurationM: Scalars['Int']['input'];
  peerMeetingId?: InputMaybe<Scalars['ID']['input']>;
  preferEarlier: Scalars['Boolean']['input'];
  startTime?: InputMaybe<Scalars['Float']['input']>;
  timeSlots: Array<Scalars['Float']['input']>;
  userId: Scalars['ID']['input'];
  userName?: InputMaybe<Scalars['String']['input']>;
};

export type MeetingOutput = {
  __typename?: 'MeetingOutput';
  error?: Maybe<Scalars['String']['output']>;
  meeting?: Maybe<Meeting>;
};

export enum MeetingStatus {
  Called = 'CALLED',
  Cancelled = 'CANCELLED',
  Finished = 'FINISHED',
  Found = 'FOUND',
  Seeking = 'SEEKING'
}

export type MeetingWithPeer = {
  __typename?: 'MeetingWithPeer';
  meeting: Meeting;
  peerMeeting?: Maybe<Meeting>;
  peerUser?: Maybe<User>;
};

export type Mutation = {
  __typename?: 'Mutation';
  callUser?: Maybe<CallEvent>;
  createOrUpdateGroup: Group;
  createOrUpdateMeeting: MeetingOutput;
  deleteGroup: Scalars['Boolean']['output'];
  deleteMeeting?: Maybe<DeleteMeetingResponse>;
  deleteUser: Scalars['Boolean']['output'];
  regenerateJoinToken: Group;
  removeUserFromGroup: Scalars['Boolean']['output'];
  setAllNotificationsSeen: Scalars['Boolean']['output'];
  setNotificationSeen?: Maybe<Notification>;
  updateMeetingStatus: Meeting;
  updateUser?: Maybe<User>;
};


export type MutationCallUserArgs = {
  input: CallUserInput;
};


export type MutationCreateOrUpdateGroupArgs = {
  input: GroupInput;
};


export type MutationCreateOrUpdateMeetingArgs = {
  input: MeetingInput;
};


export type MutationDeleteGroupArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMeetingArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteUserArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationRegenerateJoinTokenArgs = {
  groupId: Scalars['ID']['input'];
};


export type MutationRemoveUserFromGroupArgs = {
  groupId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationSetAllNotificationsSeenArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationSetNotificationSeenArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateMeetingStatusArgs = {
  input: UpdateMeetingStatusInput;
};


export type MutationUpdateUserArgs = {
  input: UserInput;
};

export type Notification = {
  __typename?: 'Notification';
  _id: Scalars['ID']['output'];
  createdAt: Scalars['Float']['output'];
  meeting?: Maybe<Meeting>;
  meetingId?: Maybe<Scalars['ID']['output']>;
  peerUserName?: Maybe<Scalars['String']['output']>;
  seen: Scalars['Boolean']['output'];
  type: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type NotificationEvent = {
  __typename?: 'NotificationEvent';
  meeting?: Maybe<Meeting>;
  type: NotificationType;
  user?: Maybe<User>;
};

export enum NotificationType {
  MeetingConnected = 'MEETING_CONNECTED',
  MeetingDisconnected = 'MEETING_DISCONNECTED',
  MeetingFinished = 'MEETING_FINISHED'
}

export type PushSubscription = {
  __typename?: 'PushSubscription';
  endpoint: Scalars['String']['output'];
  keys: PushSubscriptionKeys;
};

export type PushSubscriptionInput = {
  endpoint: Scalars['String']['input'];
  keys: PushSubscriptionKeysInput;
};

export type PushSubscriptionKeys = {
  __typename?: 'PushSubscriptionKeys';
  auth: Scalars['String']['output'];
  p256dh: Scalars['String']['output'];
};

export type PushSubscriptionKeysInput = {
  auth: Scalars['String']['input'];
  p256dh: Scalars['String']['input'];
};

export type Query = {
  __typename?: 'Query';
  getCallHistory: Array<CallHistoryEntry>;
  getCalls: Array<Call>;
  getDetailedCallHistory: Array<Call>;
  getFutureMeetingsWithPeers: Array<MeetingWithPeer>;
  getGroups: Array<Group>;
  getMyMeetingsWithPeers: Array<MeetingWithPeer>;
  getNotifications: Array<Notification>;
  getUser?: Maybe<User>;
  getUsers: Array<User>;
};


export type QueryGetCallHistoryArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryGetDetailedCallHistoryArgs = {
  targetUserId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};


export type QueryGetFutureMeetingsWithPeersArgs = {
  filterAllowedFemales?: InputMaybe<Scalars['Boolean']['input']>;
  filterAllowedMales?: InputMaybe<Scalars['Boolean']['input']>;
  filterGroups?: InputMaybe<Array<Scalars['String']['input']>>;
  filterInterests?: InputMaybe<Array<Scalars['String']['input']>>;
  filterLanguages?: InputMaybe<Array<Scalars['String']['input']>>;
  filterMaxAge?: InputMaybe<Scalars['Int']['input']>;
  filterMinAge?: InputMaybe<Scalars['Int']['input']>;
  filterMinDurationM?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};


export type QueryGetGroupsArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryGetMyMeetingsWithPeersArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryGetNotificationsArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryGetUserArgs = {
  userId: Scalars['ID']['input'];
};

export type Subscription = {
  __typename?: 'Subscription';
  onSubscriptionEvent?: Maybe<SubscriptionEvent>;
};


export type SubscriptionOnSubscriptionEventArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionEvent = {
  __typename?: 'SubscriptionEvent';
  broadcastEvent?: Maybe<BroadcastEvent>;
  callEvent?: Maybe<CallEvent>;
  notificationEvent?: Maybe<NotificationEvent>;
};

export type UpdateMeetingStatusInput = {
  _id: Scalars['ID']['input'];
  lastCallTime?: InputMaybe<Scalars['Float']['input']>;
  status?: InputMaybe<MeetingStatus>;
  totalDurationS?: InputMaybe<Scalars['Int']['input']>;
};

export type User = {
  __typename?: 'User';
  _id: Scalars['ID']['output'];
  about: Scalars['String']['output'];
  birthYear?: Maybe<Scalars['Int']['output']>;
  blocks: Array<Block>;
  contacts: Scalars['String']['output'];
  createdAt: Scalars['Float']['output'];
  deleted?: Maybe<Scalars['Boolean']['output']>;
  deletedAt?: Maybe<Scalars['Float']['output']>;
  email: Scalars['String']['output'];
  friends?: Maybe<Array<Scalars['ID']['output']>>;
  groups: Array<Scalars['ID']['output']>;
  languages: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  pushSubscriptions?: Maybe<Array<Maybe<PushSubscription>>>;
  sex: Scalars['String']['output'];
  updatedAt: Scalars['Float']['output'];
};

export type UserInput = {
  _id: Scalars['ID']['input'];
  about: Scalars['String']['input'];
  birthYear?: InputMaybe<Scalars['Int']['input']>;
  blocks: Array<BlockInput>;
  contacts: Scalars['String']['input'];
  friends?: InputMaybe<Array<Scalars['ID']['input']>>;
  groups?: InputMaybe<Array<Scalars['ID']['input']>>;
  languages: Array<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  sex: Scalars['String']['input'];
};
