const now = Date.now();

export const mockCurrentUser = {
  id: "user-me",
  name: "Shubham",
  avatar: "https://api.dicebear.com/9.x/initials/svg?seed=Shubham",
  status: "online"
};

export const mockChats = [
  {
    id: "chat-radhee",
    type: "direct",
    name: "Radhee",
    avatar: "https://api.dicebear.com/9.x/initials/svg?seed=Radhee",
    online: true,
    unreadCount: 2,
    lastMessage: "Did you eat?",
    lastMessageAt: new Date(now - 1000 * 60 * 5).toISOString(),
    participants: ["user-me", "user-radhee"]
  },
  {
    id: "chat-plans",
    type: "group",
    name: "Weekend Plans",
    avatar: "https://api.dicebear.com/9.x/shapes/svg?seed=Plans",
    online: false,
    unreadCount: 0,
    lastMessage: "Tickets are booked",
    lastMessageAt: new Date(now - 1000 * 60 * 90).toISOString(),
    participants: ["user-me", "user-radhee"]
  }
];

export const mockMessages = {
  "chat-radhee": [
    {
      id: "msg-1",
      chatId: "chat-radhee",
      senderId: "user-radhee",
      receiverId: "user-me",
      type: "text",
      text: "Are you free now?",
      media: null,
      document: null,
      status: "read",
      timestamp: new Date(now - 1000 * 60 * 33).toISOString()
    },
    {
      id: "msg-2",
      chatId: "chat-radhee",
      senderId: "user-me",
      receiverId: "user-radhee",
      type: "text",
      text: "Yes, I am here.",
      media: null,
      document: null,
      status: "read",
      timestamp: new Date(now - 1000 * 60 * 29).toISOString()
    },
    {
      id: "msg-3",
      chatId: "chat-radhee",
      senderId: "user-radhee",
      receiverId: "user-me",
      type: "text",
      text: "Did you eat?",
      media: null,
      document: null,
      status: "delivered",
      timestamp: new Date(now - 1000 * 60 * 5).toISOString()
    }
  ],
  "chat-plans": [
    {
      id: "msg-4",
      chatId: "chat-plans",
      senderId: "user-me",
      receiverId: "user-radhee",
      type: "text",
      text: "Tickets are booked",
      media: null,
      document: null,
      status: "sent",
      timestamp: new Date(now - 1000 * 60 * 90).toISOString()
    }
  ]
};
