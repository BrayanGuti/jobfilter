import { countBlacklisted } from '$lib/server/features/companies/queries/count-blacklisted';
import { countDiscarded } from '$lib/server/features/postings/queries/count-discarded';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({
	blacklistCount: countBlacklisted(),
	discardedCount: countDiscarded()
});
