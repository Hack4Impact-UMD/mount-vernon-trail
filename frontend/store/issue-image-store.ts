import { create } from 'zustand';

type IssueImages = Record<string, { before?: string; after?: string }>;

interface IssueImageStore {
  issueImages: IssueImages;
  setIssueImage: (issueId: string, before?: string, after?: string) => void;
  clearIssueImages: () => void;
}

export const useIssueImageStore = create<IssueImageStore>((set) => ({
  issueImages: {},
  setIssueImage: (issueId, before, after) =>
    set((state) => ({
      issueImages: {
        ...state.issueImages,
        [issueId]: {
          before: before ?? state.issueImages[issueId]?.before,
          after: after ?? state.issueImages[issueId]?.after,
        },
      },
    })),
  clearIssueImages: () => set({ issueImages: {} }),
}));