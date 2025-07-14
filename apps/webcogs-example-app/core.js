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
}