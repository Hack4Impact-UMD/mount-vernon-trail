import {
    flushEventPhotos,
    getIssuePhotos,
    subscribeToPhotoQueue,
    type FlushResult,
    type IssuePhotos,
} from "@/services/photo-queue";
import { useCallback, useEffect, useState } from "react";

export type PhotoQueueState = {
    issuePhotos: IssuePhotos;
    pendingCount: number;
    failedCount: number;
    uploading: boolean;
    flush: () => Promise<FlushResult>;
};

export function usePhotoQueue(eventId: string | undefined): PhotoQueueState {
    const [issuePhotos, setIssuePhotos] = useState<IssuePhotos>({});
    const [uploading, setUploading] = useState(false);

    const refresh = useCallback(async () => {
        if (!eventId) {
            setIssuePhotos({});
            return;
        }
        setIssuePhotos(await getIssuePhotos(eventId));
    }, [eventId]);

    useEffect(() => {
        let cancelled = false;
        const sync = () => {
            refresh().catch((error: unknown) => {
                if (!cancelled) console.error("Could not read photos:", error);
            });
        };
        sync();
        const unsubscribe = subscribeToPhotoQueue(sync);
        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [refresh]);

    const flush = useCallback(async (): Promise<FlushResult> => {
        if (!eventId) return { uploaded: 0, failed: 0 };
        setUploading(true);
        try {
            return await flushEventPhotos(eventId);
        } finally {
            setUploading(false);
        }
    }, [eventId]);

    const all = Object.values(issuePhotos).flatMap((slots) =>
        [slots.before, slots.after].filter((photo) => photo !== undefined),
    );

    return {
        issuePhotos,
        pendingCount: all.filter((photo) => photo.status !== "uploaded").length,
        failedCount: all.filter((photo) => photo.status === "failed").length,
        uploading,
        flush,
    };
}
