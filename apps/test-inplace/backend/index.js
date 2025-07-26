/*
@webcogs_system_prompt
@webcogs_include "backend.md"
## MySQL data structure
@webcogs_include "../../webcogs-example-app/datamodel.sql"
*/

//Section 1:
//THIS SHOULD REMAIN UNTOUCHED 

/* Manually managed code */

var org_id = 1
var db = new SQLDb("/db/run","my_auth_cookie")
var core = new MyCore(db)

/* This multiline comment should remain untouched */

/*@webcogs_func getTicketsByOrganization
Returns all tickets assigned to a particular organization. Includes info on the user it was submitted by and the organization it was assigned to.
@param core
@param organization_id
@returns array of {ticket_id,ticket_text,ticket_time,ticket_status, user_id, username, user_email, organization_id, organization_name}
*/

//AI GENERATED CODE SECTION 1
/* everything here should be replaced by the AI generated function */

/*@webcogs_endfunc*/

//Section 2:
//THIS SHOULD REMAIN UNTOUCHED 

/* More manually managed code */

var tickets = getTicketsByOrganization(core,org_id)
console.log(tickets)


/*@webcogs_func getTicketsByStatus
Returns all tickets with a particular status, ordererd descending by time.
@param core
@param status
@returns array of {ticket_id,ticket_text,ticket_time,ticket_status, submitted_by_user_id, submitted_by_username, submitted_by_user_email, assigned_to_organization_id, assigned_to_organization_name}
*/
//AI GENERATED CODE SECTION 2
// Self-closing function, webcogs_endfunc should be added below
/*@webcogs_func getUsers
Returns all users and their organization info, sorted alphabetically by surname. If sort_order is by_organization, first order by organization ID, then alphabetically by surname.
@param core
@param sort_order - "alphabetically" or "by_organization"
@returns array of {user_id,username,email,first_name,surname, organization_id,organization_name, organization_role}
*/
//AI GENERATED CODE SECTION 3
// Self-closing function, this should be replaced with AI generated function.
