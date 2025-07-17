import { WebCogsCore } from "../../js/webcogs_core.js";

export class TicketAppCore extends WebCogsCore {
	user_id = null;
	user_role = null;
	getUserId() {
		return this.user_id
	}
	getUserRole() {
		return this.user_role
	}
	async getOrganizations() {
		const response = await fetch('/api/getOrganizations');
		if (!response.ok) throw new Error('Failed to fetch organizations');
		const data = await response.json();
		const ret = this.db.convertRecordsToKeyValue(data[0]);
		return ret;
	}
}
