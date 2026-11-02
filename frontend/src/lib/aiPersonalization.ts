import { firebaseStore } from "@/lib/firebaseStore";
import { isAIPersonalizationOptedIn, setAIPersonalizationOptedIn } from "@/lib/aiSettings";

async function currentAuthUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await firebaseStore.auth.getUser();
    return (user as any)?.uid || (user as any)?.id || null;
  } catch {
    return null;
  }
}

export interface PersonalizationData {
  contextText: string;
  hasData: boolean;
  aboutMePoints: string[];
  mindPoints: string[];
  isOptedIn: boolean;
}

function emptyPersonalization(isOptedIn: boolean): PersonalizationData {
  return { contextText: "", hasData: false, aboutMePoints: [], mindPoints: [], isOptedIn };
}

export async function buildPersonalizationContext(options?: {
  lang?: "fa" | "en";
  uid?: string;
}): Promise<PersonalizationData> {
  const activeUid = await currentAuthUserId();
  const uid = options?.uid || activeUid;
  const isOptedIn = Boolean(uid && activeUid === uid && isAIPersonalizationOptedIn(uid));
  return emptyPersonalization(isOptedIn);
}

export { isAIPersonalizationOptedIn, setAIPersonalizationOptedIn };
