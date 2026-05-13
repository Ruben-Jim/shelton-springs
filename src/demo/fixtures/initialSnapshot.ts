/**
 * Realistic sample data for closed-test / preview builds.
 * Shapes mirror common Convex query results used across the app.
 * No data here is stored on any production server.
 */

const now = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;

export type DemoSnapshot = {
  residents: any[];
  hoaInfo: any;
  boardMembers: any[];
  allCommunityPosts: any[];
  commentsByPostId: Record<string, any[]>;
  allCommentsFlat: any[];
  allPolls: any[];
  /** getAllUserVotes result: map pollId -> selected option indices */
  userVotesByUserId: Record<string, Record<string, number[]>>;
  residentNotificationsActive: any[];
  petsGrouped: any[];
  allCovenants: any[];
  allDocuments: any[];
  allFees: any[];
  allFines: any[];
  homeownersPaymentStatus: any[];
  pendingVenmoPayments: any[];
  allPayments: any[];
  recentPayments: any[];
  hasPaidAnnualFeeByUserId: Record<string, boolean>;
  userPaymentsByUserId: Record<string, any[]>;
  conversationsByUserId: Record<string, any[]>;
  messagesByConversationId: Record<string, any[]>;
  unreadNotificationsByUserId: Record<string, any[]>;
  unreadCountByUserId: Record<string, number>;
};

export const DEMO_RESIDENT_ID = 'demo_user_resident_1';
/** Synthetic `_id` for the board login account; matches residents / snapshot maps. */
export const DEMO_BOARD_ID = 'demo_user_board_1';
const DEMO_RENTER_ID = 'demo_user_renter_1';

// ---------------------------------------------------------------------------
// Resident fixtures
// ---------------------------------------------------------------------------

const sarahMitchell: any = {
  _id: DEMO_RESIDENT_ID,
  email: 'sarah.mitchell@sheltonsprings.homes',
  password: 'demo123',
  firstName: 'Sarah',
  lastName: 'Mitchell',
  phone: '(512) 555-0184',
  address: '142 Shelton Springs Dr',
  unitNumber: '',
  isResident: true,
  isBoardMember: false,
  isRenter: false,
  isDev: false,
  isActive: true,
  isBlocked: false,
  profileImage: null,
  createdAt: now - 365 * DAY,
  updatedAt: now - 10 * DAY,
};

const michaelTorres: any = {
  _id: DEMO_BOARD_ID,
  email: 'michael.torres@sheltonsprings.homes',
  password: 'demo123',
  firstName: 'Michael',
  lastName: 'Torres',
  phone: '(512) 555-0231',
  address: '208 Ridgeview Court',
  unitNumber: '',
  isResident: true,
  isBoardMember: true,
  isRenter: false,
  isDev: false,
  isActive: true,
  isBlocked: false,
  profileImage: null,
  createdAt: now - 730 * DAY,
  updatedAt: now - 3 * DAY,
};

const jamesWright: any = {
  _id: DEMO_RENTER_ID,
  email: 'james.wright@gmail.com',
  password: 'demo123',
  firstName: 'James',
  lastName: 'Wright',
  phone: '(512) 555-0317',
  address: '95 Elmwood Place',
  unitNumber: 'B',
  isResident: false,
  isBoardMember: false,
  isRenter: true,
  isDev: false,
  isActive: true,
  isBlocked: false,
  profileImage: null,
  createdAt: now - 180 * DAY,
  updatedAt: now - 5 * DAY,
};

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export const initialDemoSnapshot: DemoSnapshot = {
  residents: [sarahMitchell, michaelTorres, jamesWright],

  hoaInfo: {
    name: 'Shelton Springs HOA',
    address: '1 Community Center Drive, Austin, TX 78732',
    phone: '(512) 555-0100',
    email: 'contact@sheltonsprings.homes',
    website: 'https://sheltonsprings.homes',
    officeHours: 'Mon – Fri  9:00 AM – 5:00 PM',
    emergencyContact: 'After-hours: (512) 555-0911',
    eventText: 'Community BBQ — Saturday, June 7 · 4:00 PM at the pavilion. Bring a side dish!',
    ccrsPdfStorageId: undefined,
  },

  boardMembers: [
    {
      _id: 'demo_bm_1',
      name: 'Michael Torres',
      position: 'President',
      email: 'michael.torres@sheltonsprings.homes',
      phone: '(512) 555-0231',
      termEnd: '2027-12-31',
      bio: 'Michael has lived in Shelton Springs for eight years and chairs the landscaping committee.',
      image: null,
    },
    {
      _id: 'demo_bm_2',
      name: 'Linda Park',
      position: 'Secretary',
      email: 'linda.park@sheltonsprings.homes',
      phone: '(512) 555-0188',
      termEnd: '2026-12-31',
      bio: 'Linda manages meeting minutes and coordinates resident communications.',
      image: null,
    },
    {
      _id: 'demo_bm_3',
      name: 'David Okafor',
      position: 'Treasurer',
      email: 'david.okafor@sheltonsprings.homes',
      phone: '(512) 555-0256',
      termEnd: '2026-12-31',
      bio: 'David oversees the HOA budget, reserves, and annual financial reporting.',
      image: null,
    },
  ],

  allCommunityPosts: [
    {
      _id: 'demo_post_1',
      title: 'Pool reopens May 24 — updated hours for summer',
      content:
        'Great news — the main pool will reopen Saturday, May 24. Summer hours are 7 AM – 10 PM daily. Pool keys must be registered at the office. Please make sure guests follow the posted capacity rules. Reach out to the office with any questions!',
      author: 'Michael Torres',
      category: 'Announcement',
      likes: 14,
      createdAt: now - 2 * DAY,
      comments: [],
      authorProfileImage: null,
      images: [],
      videos: [],
    },
    {
      _id: 'demo_post_2',
      title: 'Anyone missing a golden retriever? Found on Ridgeview Ct',
      content:
        "Found a friendly golden retriever near 200 Ridgeview Court around 6 PM yesterday. He has a blue collar but no tag. He's safe with us \u2014 please message me or call (512) 555-0184 if he's yours!",
      author: 'Sarah Mitchell',
      category: 'General',
      likes: 8,
      createdAt: now - 18 * HOUR,
      comments: [],
      authorProfileImage: null,
      images: [],
      videos: [],
    },
    {
      _id: 'demo_post_3',
      title: 'Reminder: trash bins must be stored by 8 PM on collection day',
      content:
        'A quick reminder per Section 4.2 of our CC&Rs: trash and recycling bins must be returned to your garage or side yard by 8 PM on collection day. Several bins have been left out overnight on Elmwood Place. First reminder is courtesy — continued violations may result in a fine. Thanks for keeping our streets looking great!',
      author: 'Michael Torres',
      category: 'Reminder',
      likes: 5,
      createdAt: now - 4 * DAY,
      comments: [],
      authorProfileImage: null,
      images: [],
      videos: [],
    },
    {
      _id: 'demo_post_4',
      title: 'Selling — 2019 Trek bike, barely used',
      content:
        'Selling my Trek FX 3 commuter bike. Barely used, great condition. $380 OBO. Pickup at 142 Shelton Springs Dr. DM me here or text (512) 555-0184.',
      author: 'Sarah Mitchell',
      category: 'Marketplace',
      likes: 2,
      createdAt: now - 6 * DAY,
      comments: [],
      authorProfileImage: null,
      images: [],
      videos: [],
    },
  ],

  commentsByPostId: {
    demo_post_1: [
      {
        _id: 'demo_comment_1',
        postId: 'demo_post_1',
        author: 'Sarah Mitchell',
        content: 'Thank you! Been waiting for this. Do guest passes still work the same way?',
        createdAt: now - 2 * DAY + 30 * 60000,
        authorProfileImage: null,
      },
      {
        _id: 'demo_comment_2',
        postId: 'demo_post_1',
        author: 'Michael Torres',
        content: 'Yes — up to 2 guests per household, same as last year. They just need to sign in at the gate.',
        createdAt: now - 2 * DAY + 60 * 60000,
        authorProfileImage: null,
      },
    ],
    demo_post_2: [
      {
        _id: 'demo_comment_3',
        postId: 'demo_post_2',
        author: 'James Wright',
        content: 'Shared in the neighborhood Facebook group. Hope you find the owner soon!',
        createdAt: now - 16 * HOUR,
        authorProfileImage: null,
      },
    ],
  },

  allCommentsFlat: [
    {
      _id: 'demo_comment_1',
      postId: 'demo_post_1',
      author: 'Sarah Mitchell',
      content: 'Thank you! Been waiting for this. Do guest passes still work the same way?',
      createdAt: now - 2 * DAY + 30 * 60000,
    },
    {
      _id: 'demo_comment_2',
      postId: 'demo_post_1',
      author: 'Michael Torres',
      content: 'Yes — up to 2 guests per household, same as last year. They just need to sign in at the gate.',
      createdAt: now - 2 * DAY + 60 * 60000,
    },
    {
      _id: 'demo_comment_3',
      postId: 'demo_post_2',
      author: 'James Wright',
      content: 'Shared in the neighborhood Facebook group. Hope you find the owner soon!',
      createdAt: now - 16 * HOUR,
    },
  ],

  allPolls: [
    {
      _id: 'demo_poll_1',
      title: 'Should we add pickleball courts to the recreation area?',
      description:
        'The board is considering converting the unused east tennis court into two pickleball courts. This would require a one-time $8,200 capital expenditure from reserves. Cast your vote!',
      options: ['Yes — add pickleball courts', 'No — keep the tennis court', 'Neutral / no preference'],
      allowMultipleVotes: false,
      isActive: true,
      createdAt: now - 3 * DAY,
      expiresAt: now + 14 * DAY,
      votes: [
        { userId: DEMO_BOARD_ID, selectedOptions: [0] },
        { userId: DEMO_RENTER_ID, selectedOptions: [0] },
      ],
      createdBy: DEMO_BOARD_ID,
    },
    {
      _id: 'demo_poll_2',
      title: 'Preferred day for the annual community cleanup',
      description: 'Help us pick the best date for our spring community cleanup event. Gloves and bags will be provided!',
      options: ['Saturday, June 14', 'Sunday, June 15', 'Saturday, June 21'],
      allowMultipleVotes: false,
      isActive: true,
      createdAt: now - 7 * DAY,
      expiresAt: now + 7 * DAY,
      votes: [{ userId: DEMO_RENTER_ID, selectedOptions: [2] }],
      createdBy: DEMO_BOARD_ID,
    },
  ],

  userVotesByUserId: {
    [DEMO_RESIDENT_ID]: {} as Record<string, number[]>,
    [DEMO_BOARD_ID]: { demo_poll_1: [0] } as Record<string, number[]>,
    [DEMO_RENTER_ID]: { demo_poll_1: [0], demo_poll_2: [2] } as Record<string, number[]>,
  },

  residentNotificationsActive: [
    {
      _id: 'demo_rn_1',
      residentId: DEMO_RESIDENT_ID,
      type: 'Selling',
      listingDate: '2026-05-01',
      closingDate: '',
      realtorInfo: 'Keller Williams – Austin Central',
      newResidentName: '',
      isRental: false,
      additionalInfo: 'Listing at $485,000. Open house scheduled for May 18.',
      isActive: true,
      createdAt: now - 12 * DAY,
    },
  ],

  petsGrouped: [
    {
      residentId: DEMO_RESIDENT_ID,
      residentName: 'Sarah Mitchell',
      pets: [
        {
          _id: 'demo_pet_1',
          name: 'Biscuit',
          breed: 'Labrador Mix',
          image: null,
          residentId: DEMO_RESIDENT_ID,
        },
      ],
    },
    {
      residentId: DEMO_RENTER_ID,
      residentName: 'James Wright',
      pets: [
        {
          _id: 'demo_pet_2',
          name: 'Mochi',
          breed: 'Shiba Inu',
          image: null,
          residentId: DEMO_RENTER_ID,
        },
      ],
    },
  ],

  allCovenants: [
    {
      _id: 'demo_cov_1',
      title: 'Landscaping & Lawn Maintenance',
      description:
        'Lawns must be mowed at least once every two weeks between April and October, and at least once per month from November through March. Weeds, dead vegetation, and overgrown hedges must be removed promptly. Front yard landscaping alterations exceeding $500 in value require prior architectural review approval.',
      category: 'Landscaping',
      lastUpdated: new Date(now - 90 * DAY).toISOString(),
      fileStorageId: null,
    },
    {
      _id: 'demo_cov_2',
      title: 'Architectural Modifications',
      description:
        'No exterior structural modification, addition, or alteration — including fences, decks, patios, sheds, or paint color changes — may be commenced without written approval from the Architectural Review Committee (ARC). Submit ARC request forms at least 30 days before the proposed start date. Approved modifications must match submitted plans.',
      category: 'Architecture',
      lastUpdated: new Date(now - 120 * DAY).toISOString(),
      fileStorageId: null,
    },
    {
      _id: 'demo_cov_3',
      title: 'Pet Policy',
      description:
        'Residents may keep up to two (2) domestic pets per household. All dogs must be leashed in common areas at all times. Pet owners are responsible for immediately cleaning up after their animals. Aggressive animals must be reported to the HOA management office. Exotic or farm animals are not permitted.',
      category: 'General',
      lastUpdated: new Date(now - 200 * DAY).toISOString(),
      fileStorageId: null,
    },
    {
      _id: 'demo_cov_4',
      title: 'Noise & Nuisance',
      description:
        'Loud music, power tools, or other disruptive noise is prohibited between 10:00 PM and 7:00 AM on weekdays and between 11:00 PM and 8:00 AM on weekends and holidays. Repeated noise violations may result in fines starting at $100 per occurrence.',
      category: 'General',
      lastUpdated: new Date(now - 60 * DAY).toISOString(),
      fileStorageId: null,
    },
    {
      _id: 'demo_cov_5',
      title: 'Vehicle & Parking Rules',
      description:
        'Vehicles must be parked in designated driveways or approved parking areas. Street parking is permitted for up to 72 hours. Commercial vehicles, boats, RVs, and trailers may not be parked in driveways or on streets for more than 24 hours without board approval. Inoperative vehicles must be removed within 7 days.',
      category: 'General',
      lastUpdated: new Date(now - 45 * DAY).toISOString(),
      fileStorageId: null,
    },
  ],

  allDocuments: [
    {
      _id: 'demo_doc_1',
      title: '2025 Annual Meeting Minutes',
      description: 'Approved minutes from the Shelton Springs HOA Annual Meeting held January 18, 2025.',
      category: 'General',
      type: 'Minutes',
      uploadedAt: now - 110 * DAY,
      fileStorageId: null,
    },
    {
      _id: 'demo_doc_2',
      title: '2025 Adopted Budget',
      description: 'Board-approved operating and reserve budget for the fiscal year January–December 2025.',
      category: 'General',
      type: 'Minutes',
      uploadedAt: now - 130 * DAY,
      fileStorageId: null,
    },
    {
      _id: 'demo_doc_3',
      title: 'Architectural Review Guidelines (2024 rev.)',
      description: 'Updated ARC submission requirements, approval timelines, and approved material lists.',
      category: 'Architecture',
      type: 'Minutes',
      uploadedAt: now - 200 * DAY,
      fileStorageId: null,
    },
  ],

  allFees: [
    {
      _id: 'demo_fee_1',
      userId: DEMO_RESIDENT_ID,
      address: '142 Shelton Springs Dr',
      name: '2025 Annual HOA Dues',
      amount: 480,
      frequency: 'Annually',
      status: 'Pending',
      dueDate: '2025-03-31',
      description: 'Annual assessment covering landscaping of common areas, pool maintenance, and reserve contributions.',
    },
    {
      _id: 'demo_fee_2',
      userId: DEMO_RENTER_ID,
      address: '95 Elmwood Place, Unit B',
      name: '2025 Annual HOA Dues',
      amount: 480,
      frequency: 'Annually',
      status: 'Paid',
      dueDate: '2025-03-31',
      description: 'Annual assessment covering landscaping of common areas, pool maintenance, and reserve contributions.',
    },
  ],

  allFines: [
    {
      _id: 'demo_fine_1',
      residentId: DEMO_RESIDENT_ID,
      address: '142 Shelton Springs Dr',
      violation: 'Trash bin left on street past 8 PM',
      amount: 50,
      status: 'Pending',
      dateIssued: new Date(now - 14 * DAY).toISOString().slice(0, 10),
      dueDate: new Date(now + 16 * DAY).toISOString().slice(0, 10),
      description:
        'Trash and recycling bins were observed on the street past 8 PM on collection day, in violation of Section 4.2 of the CC&Rs. First offence — courtesy fine.',
    },
  ],

  homeownersPaymentStatus: [
    {
      userId: DEMO_RESIDENT_ID,
      name: 'Sarah Mitchell',
      address: '142 Shelton Springs Dr',
      hasPaidAnnual: false,
      annualFeeAmount: 480,
    },
    {
      userId: DEMO_BOARD_ID,
      name: 'Michael Torres',
      address: '208 Ridgeview Court',
      hasPaidAnnual: true,
      annualFeeAmount: 480,
    },
    {
      userId: DEMO_RENTER_ID,
      name: 'James Wright',
      address: '95 Elmwood Place, Unit B',
      hasPaidAnnual: true,
      annualFeeAmount: 480,
    },
  ],

  pendingVenmoPayments: [],

  allPayments: [
    {
      _id: 'demo_pay_2',
      userId: DEMO_BOARD_ID,
      amount: 480,
      feeType: '2025 Annual HOA Dues',
      paymentMethod: 'Check',
      status: 'Approved',
      verificationStatus: 'Verified',
      paymentDate: new Date(now - 60 * DAY).toISOString(),
      checkNumber: '4412',
    },
    {
      _id: 'demo_pay_3',
      userId: DEMO_RENTER_ID,
      amount: 480,
      feeType: '2025 Annual HOA Dues',
      paymentMethod: 'Venmo',
      status: 'Approved',
      verificationStatus: 'Verified',
      paymentDate: new Date(now - 45 * DAY).toISOString(),
      venmoUsername: '@jwright95',
      transactionId: 'VNM-8823941',
    },
  ],

  recentPayments: [
    {
      _id: 'demo_pay_2',
      userId: DEMO_BOARD_ID,
      amount: 480,
      feeType: '2025 Annual HOA Dues',
      paymentMethod: 'Check',
      status: 'Approved',
      verificationStatus: 'Verified',
      paymentDate: new Date(now - 60 * DAY).toISOString(),
      checkNumber: '4412',
    },
    {
      _id: 'demo_pay_3',
      userId: DEMO_RENTER_ID,
      amount: 480,
      feeType: '2025 Annual HOA Dues',
      paymentMethod: 'Venmo',
      status: 'Approved',
      verificationStatus: 'Verified',
      paymentDate: new Date(now - 45 * DAY).toISOString(),
      venmoUsername: '@jwright95',
      transactionId: 'VNM-8823941',
    },
  ],

  hasPaidAnnualFeeByUserId: {
    [DEMO_RESIDENT_ID]: false,
    [DEMO_BOARD_ID]: true,
    [DEMO_RENTER_ID]: true,
  },

  userPaymentsByUserId: {
    [DEMO_RESIDENT_ID]: [],
    [DEMO_BOARD_ID]: [
      {
        _id: 'demo_pay_2',
        userId: DEMO_BOARD_ID,
        amount: 480,
        feeType: '2025 Annual HOA Dues',
        paymentMethod: 'Check',
        status: 'Approved',
        verificationStatus: 'Verified',
        paymentDate: new Date(now - 60 * DAY).toISOString(),
        checkNumber: '4412',
      },
    ],
    [DEMO_RENTER_ID]: [
      {
        _id: 'demo_pay_3',
        userId: DEMO_RENTER_ID,
        amount: 480,
        feeType: '2025 Annual HOA Dues',
        paymentMethod: 'Venmo',
        status: 'Approved',
        verificationStatus: 'Verified',
        paymentDate: new Date(now - 45 * DAY).toISOString(),
        venmoUsername: '@jwright95',
        transactionId: 'VNM-8823941',
      },
    ],
  },

  conversationsByUserId: {
    [DEMO_BOARD_ID]: [
      {
        _id: 'demo_conv_1',
        participants: [DEMO_BOARD_ID, DEMO_RESIDENT_ID],
        createdBy: DEMO_BOARD_ID,
        createdAt: now - 3 * DAY,
        updatedAt: now - HOUR,
        latestMessage: {
          _id: 'demo_msg_3',
          conversationId: 'demo_conv_1',
          senderId: DEMO_RESIDENT_ID,
          senderName: 'Sarah Mitchell',
          senderRole: 'Resident',
          content: "Got it — I'll make sure it's put away before 8 PM from now on. Thanks for the heads-up.",
          createdAt: now - HOUR,
        },
        otherParticipant: {
          id: DEMO_RESIDENT_ID,
          name: 'Sarah Mitchell',
          email: 'sarah.mitchell@sheltonsprings.homes',
          profileImage: undefined,
          isBoardMember: false,
        },
      },
    ],
    [DEMO_RESIDENT_ID]: [
      {
        _id: 'demo_conv_1',
        participants: [DEMO_BOARD_ID, DEMO_RESIDENT_ID],
        createdBy: DEMO_BOARD_ID,
        createdAt: now - 3 * DAY,
        updatedAt: now - HOUR,
        latestMessage: {
          _id: 'demo_msg_3',
          conversationId: 'demo_conv_1',
          senderId: DEMO_RESIDENT_ID,
          senderName: 'Sarah Mitchell',
          senderRole: 'Resident',
          content: "Got it — I'll make sure it's put away before 8 PM from now on. Thanks for the heads-up.",
          createdAt: now - HOUR,
        },
        otherParticipant: {
          id: DEMO_BOARD_ID,
          name: 'Michael Torres',
          email: 'michael.torres@sheltonsprings.homes',
          profileImage: undefined,
          isBoardMember: true,
        },
      },
    ],
  },

  messagesByConversationId: {
    demo_conv_1: [
      {
        _id: 'demo_msg_1',
        conversationId: 'demo_conv_1',
        senderId: DEMO_BOARD_ID,
        senderName: 'Michael Torres',
        senderRole: 'Board',
        content:
          'Hi Sarah, just a friendly reminder that trash bins need to be stowed by 8 PM on collection day per Section 4.2. Looks like yours may have been left out last Tuesday. No fine this time — just wanted to flag it!',
        createdAt: now - 3 * DAY,
      },
      {
        _id: 'demo_msg_2',
        conversationId: 'demo_conv_1',
        senderId: DEMO_RESIDENT_ID,
        senderName: 'Sarah Mitchell',
        senderRole: 'Resident',
        content: 'Hi Michael, thanks for letting me know — I was traveling that day and forgot to ask my neighbor to bring it in. I appreciate the courtesy notice.',
        createdAt: now - 2 * DAY,
      },
      {
        _id: 'demo_msg_3',
        conversationId: 'demo_conv_1',
        senderId: DEMO_RESIDENT_ID,
        senderName: 'Sarah Mitchell',
        senderRole: 'Resident',
        content: "Got it — I'll make sure it's put away before 8 PM from now on. Thanks for the heads-up.",
        createdAt: now - HOUR,
      },
    ],
  },

  unreadNotificationsByUserId: {
    [DEMO_RESIDENT_ID]: [
      {
        _id: 'demo_notif_1',
        userId: DEMO_RESIDENT_ID,
        title: 'Annual dues reminder',
        body: 'Your 2025 HOA dues of $480 are due by March 31. Pay via the Fees tab to avoid late charges.',
        type: 'Fee',
        isRead: false,
        createdAt: now - 5 * DAY,
      },
    ],
    [DEMO_BOARD_ID]: [],
  },

  unreadCountByUserId: {
    [DEMO_RESIDENT_ID]: 1,
    [DEMO_BOARD_ID]: 0,
  },
};

// ---------------------------------------------------------------------------
// Login accounts (used by demoAuth.ts)
// ---------------------------------------------------------------------------

export const DEMO_LOGIN_ACCOUNTS: Array<{
  email: string;
  password: string;
  user: any;
}> = [
  {
    email: 'sarah.mitchell@sheltonsprings.homes',
    password: 'demo123',
    user: sarahMitchell,
  },
  {
    email: 'michael.torres@sheltonsprings.homes',
    password: 'demo123',
    user: michaelTorres,
  },
  {
    email: 'james.wright@gmail.com',
    password: 'demo123',
    user: jamesWright,
  },
];
