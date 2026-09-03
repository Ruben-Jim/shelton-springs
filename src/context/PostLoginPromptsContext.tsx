import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';

type PostLoginPromptsContextValue = {
  isPromptBlocked: boolean;
  setPromptBlocked: (key: string, blocked: boolean) => void;
  notificationPromptHandled: boolean;
  setNotificationPromptHandled: (handled: boolean) => void;
};

const PostLoginPromptsContext = createContext<PostLoginPromptsContextValue | undefined>(
  undefined
);

export const PostLoginPromptsProvider = ({ children }: { children: ReactNode }) => {
  const blockers = useRef(new Set<string>());
  const [isPromptBlocked, setIsPromptBlocked] = useState(false);
  const [notificationPromptHandled, setNotificationPromptHandled] = useState(false);

  const setPromptBlocked = useCallback((key: string, blocked: boolean) => {
    if (blocked) {
      blockers.current.add(key);
    } else {
      blockers.current.delete(key);
    }
    setIsPromptBlocked(blockers.current.size > 0);
  }, []);

  const value = useMemo(
    () => ({
      isPromptBlocked,
      setPromptBlocked,
      notificationPromptHandled,
      setNotificationPromptHandled,
    }),
    [isPromptBlocked, setPromptBlocked, notificationPromptHandled]
  );

  return (
    <PostLoginPromptsContext.Provider value={value}>
      {children}
    </PostLoginPromptsContext.Provider>
  );
};

export const usePostLoginPrompts = () => {
  const context = useContext(PostLoginPromptsContext);
  if (context === undefined) {
    throw new Error('usePostLoginPrompts must be used within a PostLoginPromptsProvider');
  }
  return context;
};
