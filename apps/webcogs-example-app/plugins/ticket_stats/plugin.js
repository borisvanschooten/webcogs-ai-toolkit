/*@webcogs_system_prompt
# Docs for writing a plugin

A plugin is a module that can interact with the user via HTML widgets, or process information.  A plugin is always defined as a single export class, and should be written in vanilla Javascript. Always define the class as an "export class". Do not assume any libraries are available.  For example, do not use jquery.  The class constructor always has this signature: 
constructor(core, ...custom_params). Parameter "core" is the core object, which contains the core API functions.  The constructor can be any number of additional custom parameters.

The plugin class is constructed when the core app invokes the plugin, and can be destroyed and constructed any number of times during the app's lifecycle.

## Core functions

The following functions are available to all plugins, via the "core" object.

function core.mount(location, html_code, css_code) - Show a widget to the user by mounting the given HTML in a shadow DOM.  Returns the shadow root element, which should be used to query the HTML inside the widget.  It is possible for a plugin to have multiple widgets, or none.
core.mount has the following parameters:
- location - a string, indicating where to place the user interface element.  The complete set of available locations is defined in the section "available core.mount locations".  Use only these.
- html_code - a string with a HTML snippet that contains the user interface for the widget
- css_code - corresponding styling for html_code.  This should be a CSS snippet.  The \<style\> tag should not be included.

function core.route(route, ...custom_params) - Invoke the core router.
core.route has the following parameters:
- route - a string describing the route. The format of the route is defined in the section "core.route routes". Use only these.
- custom_params - there can be any number of custom parameters.

function core.translate(string) - Translate a string into the user's language.

## Core properties

core.db is a SQLite compatible database object. It has the following functions: 
- async function db.run(sql_statement, optional_values) - execute a SQL statement or query. Note this is an async function. If it is a query, returns an array of objects, otherwise returns null. Each object represents a record, with keys representing the column names and values the record values. If optional_values is supplied, it should be an array, with its elements bound to "?" symbols in the sql_statement string. For example: db.run("SELECT * FROM my_table WHERE id=?",[1000]) will be interpolated to "SELECT * FROM my_table where id=1000". 

## Additional core functions

core.getUserId() - get ID of logged in user
core.getUserRole() - get role of logged in user (user, developer, or admin)
async core.getOrganizations() - get all Organization records

## available core.mount locations

- modal_dialog - modal dialog that displays as an overlay
- main - main area of screen
- nav_bar - navigation bar for main menu
- side_bar - side bar for submenus

## core.route routes

A route is a string that indicates a widget plugin name.

## Style guide

Use the classes, styles, and properties in the supplied CSS definitions as much as possible. Do not override the styles in the CSS classes you use, use them as-is.  You can assume they are available to any widgets you mount.

For widgets using modal_dialog, use the full available width.

## General guidelines

Widgets should always display a title.

If showing an organization, always show the organisation name and not the organization ID.

Users should be shown like this: first_name surname (@username)

Ticket should be shown like this: Ticket #ticket_id

This is a multilingual applicatiom. Run all literal strings / texts in the code and HTML through core.translate(). Do not write your own wrapper function, always call core.translate directly.


## CSS definitions

:root {
  --text-color: #000;
  --main-bg-color: #fff;
  --button-bg-color: #bbf;
  --button-text-color: #006;
  --highlight-ticket-bg-color: #fcc;
  --mainmenu-item-selected-bg-color: #66f;
}

\/* Use UL/LI with the following classes for mainmenu *\/
ul.mainmenu {
  list-style: none;
  display: flex;
  gap: 15px;
  background-color: #222;
  margin: 8px;
}
li.mainmenu-item {
  cursor: pointer;
  padding: 10px 5px;
  user-select: none;
  color: #fff;
}

@media (max-width: 700px) {
    ul.mainmenu {
        display: block;
        height: auto;
    }
}

span.logged-in-user {
  font-size: 18px;
  cursor: pointer;
  color: #fff;
}


\/* Use the organization-avatar styles to add an avatar to each organization *\/
div.organization-avatar {
  display: inline-block;
  width: 30px;
  height: 30px;
}
\/* Avatar variant for null organization *\/
div.organization-avatar.id-none {
  background-color: #eee;
}
\/* Avatar variants numbered "id-1" through "id-6" *\/
div.organization-avatar.id-1 {
  background-color: #f84;
}
div.organization-avatar.id-2 {
  background-color: #fe4;
}
div.organization-avatar.id-3 {
  background-color: #0f0;
}
div.organization-avatar.id-4 {
  background-color: #2df;
}
div.organization-avatar.id-5 {
  background-color: #66f;
}
div.organization-avatar.id-6 {
  background-color: #f4f;
}

input[type="text"], input[type="email"] {
  width: 100%;
}
select {
  background-color: var(--button-bg-color);
  font-size: 18px;
  padding: 4px;
}
button {
  background-color: var(--button-bg-color);
  color: var(--button-text-color);
  padding: 4px 12px;
  font-size: 18px;
  cursor: pointer;
}
pre {
  white-space: pre-wrap;
}

## SQL table definitions


-- Organization role is one of: customer, vendor
CREATE TABLE Organization (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL
);

-- User role is one of: user, developer, admin
CREATE TABLE User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    organization_id INTEGER NOT NULL,
    role TEXT NOT NULL
);

-- Ticket status is same as status of last response
-- Status can be: open, in_progress, fixed, not_fixed
CREATE TABLE Ticket (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	submitted_by INTEGER NOT NULL, -- user ID who submitted the ticket
    assigned_to INTEGER, -- organization ID which the ticket is assigned to
	text TEXT NOT NULL,
	time DATETIME NOT NULL,
    status TEXT NOT NULL
);

-- A ticket can have any number of responses
-- Each response sets at least one of the fields: assigned_to, status, or text.
CREATE TABLE Response (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    time DATETIME NOT NULL,
    assigned_to TEXT,
    status TEXT,
    text TEXT
)

@webcogs_user_prompt
Show the total number of tickets subdivided by status and assigned organization in a table. If you click on a status column header, route to ticketadmin with as parameter the status.  Below that, show a stacked bar chart that shows the number of submitted tickets and the number of responses per day over the last 30 days. Show every other date in the form mm-dd at the x axis, and ticks on the y axis. Also show a legend.
@webcogs_end_prompt_section*/
export class TicketStatusSummary {
  constructor(core) {
    this.core = core;
    this.statuses = ["open", "in_progress", "fixed", "not_fixed"];
    // kick off async init, without awaiting in constructor
    (async () => {
      await this.init();
    })();
  }

  async init() {
    // Prepare HTML scaffold
    const html = `
      <div id="ticket-stats-wrapper">
        <h2>${this.core.translate("Ticket overview")}</h2>
        <h3>${this.core.translate("Tickets by status and assigned organization")}</h3>
        <table id="tickets-table">
          <thead>
            <tr>
              <th>${this.core.translate("Organization")}</th>
              ${this.statuses.map(st => `<th data-status="${st}" class="status-header">${this.core.translate(st)}</th>`).join("")}
              <th>${this.core.translate("Total")}</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <h3>${this.core.translate("Activity last 30 days")}</h3>
        <canvas id="activity-chart" width="900" height="400"></canvas>
        <div id="legend" style="margin-top:8px;"></div>
      </div>
    `;

    const css = `
      #ticket-stats-wrapper { color: var(--text-color); background: var(--main-bg-color); padding: 12px; }
      #tickets-table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
      #tickets-table th, #tickets-table td { border: 1px solid #ccc; padding: 6px; text-align: center; }
      #tickets-table th.status-header { cursor: pointer; background-color: var(--button-bg-color); color: var(--button-text-color); }
      #tickets-table tbody tr:nth-child(even) { background-color: #f9f9f9; }
    `;

    this.shadow = this.core.mount("main", html, css);

    // Add click listeners to status headers
    const headers = this.shadow.querySelectorAll('th.status-header');
    headers.forEach(th => {
      th.addEventListener('click', () => {
        const status = th.getAttribute('data-status');
        this.core.route('ticketadmin', status);
      });
    });

    await this.populateTable();
    await this.drawChart();
  }

  async populateTable() {
    // Fetch organization names first
    const orgRows = await this.core.getOrganizations(); // returns array with {id,name,...}
    const orgMap = {};
    orgRows.forEach(o => { orgMap[o.id] = o.name; });

    // Query counts
    const rows = await this.core.db.run(`
      SELECT assigned_to AS org_id, status, COUNT(*) AS cnt
      FROM Ticket
      GROUP BY assigned_to, status
    `);

    // Build structure: {org_id/null: {status:count}}
    const data = {};
    rows.forEach(r => {
      const oid = r.org_id === null ? "none" : r.org_id;
      if (!data[oid]) data[oid] = {};
      data[oid][r.status] = r.cnt;
    });

    // Ensure every organization present
    Object.keys(orgMap).forEach(id => { if(!data[id]) data[id] = {}; });
    if (!data["none"]) data["none"] = {}; // for unassigned

    const tbody = this.shadow.querySelector('#tickets-table tbody');
    tbody.innerHTML = "";

    Object.keys(data).forEach(oid => {
      const orgName = oid === "none" ? this.core.translate("Unassigned") : orgMap[oid] || (this.core.translate("Org") + " " + oid);
      const rowCounts = data[oid];
      let total = 0;
      const tds = this.statuses.map(st => {
        const c = rowCounts[st] || 0; total += c; return `<td>${c}</td>`;
      }).join("");
      const tr = `<tr><td>${orgName}</td>${tds}<td>${total}</td></tr>`;
      tbody.insertAdjacentHTML('beforeend', tr);
    });
  }

  async drawChart() {
    const canvas = this.shadow.getElementById('activity-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // date range last 30 days including today
    const dates = [];
    const now = new Date();
    for (let i=29; i>=0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate()-i);
      dates.push(d);
    }

    // Build date strings yyyy-mm-dd for SQL comparison
    const dateStrings = dates.map(d => d.toISOString().slice(0,10));

    // Tickets per day
    const ticketRows = await this.core.db.run(`
      SELECT date(time) AS d, COUNT(*) AS c FROM Ticket
      WHERE date(time) >= date('now','-29 days')
      GROUP BY d
    `);
    const ticketMap = {};
    ticketRows.forEach(r => { ticketMap[r.d] = r.c; });

    // Responses per day
    const respRows = await this.core.db.run(`
      SELECT date(time) AS d, COUNT(*) AS c FROM Response
      WHERE date(time) >= date('now','-29 days')
      GROUP BY d
    `);
    const respMap = {};
    respRows.forEach(r => { respMap[r.d] = r.c; });

    const ticketCounts = dateStrings.map(ds => ticketMap[ds] || 0);
    const respCounts = dateStrings.map(ds => respMap[ds] || 0);

    // Determine scale
    const totals = dateStrings.map((_,i) => ticketCounts[i]+respCounts[i]);
    const maxTotal = Math.max(...totals,1);

    // Clear canvas
    ctx.clearRect(0,0,width,height);

    const margin = 40;
    const chartWidth = width - margin*2;
    const chartHeight = height - margin*2;

    const barWidth = chartWidth / dates.length - 4; // small gap

    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // y axis ticks
    const numTicks = 5;
    for (let i=0;i<=numTicks;i++){
      const yVal = i/numTicks*maxTotal;
      const y = height - margin - (yVal/maxTotal)*chartHeight;
      ctx.beginPath();
      ctx.moveTo(margin-5, y);
      ctx.lineTo(margin, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(yVal), margin-7, y+4);
    }

    // bars
    const ticketColor = '#66f';
    const respColor = '#f84';
    for(let i=0;i<dates.length;i++){
      const x = margin + i*(barWidth+4)+2;
      const total = totals[i];
      const ticketHeight = (ticketCounts[i]/maxTotal)*chartHeight;
      const respHeight = (respCounts[i]/maxTotal)*chartHeight;
      let yCursor = height - margin;

      // draw ticket segment (bottom)
      ctx.fillStyle = ticketColor;
      ctx.fillRect(x, yCursor - ticketHeight, barWidth, ticketHeight);
      yCursor -= ticketHeight;

      // draw response segment (top)
      ctx.fillStyle = respColor;
      ctx.fillRect(x, yCursor - respHeight, barWidth, respHeight);

      // x axis labels every other date
      if (i % 2 === 0) {
        ctx.save();
        ctx.translate(x + barWidth/2, height - margin + 12);
        ctx.rotate(-Math.PI/4);
        const label = (dates[i].getMonth()+1).toString().padStart(2,'0') + '-' + dates[i].getDate().toString().padStart(2,'0');
        ctx.textAlign = 'right';
        ctx.fillStyle = '#000';
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }

    // Legend
    const legendDiv = this.shadow.getElementById('legend');
    legendDiv.innerHTML = `
      <span style="display:inline-block;width:15px;height:15px;background:${ticketColor};margin-right:4px;"></span>${this.core.translate("Submitted tickets")} &nbsp;&nbsp;
      <span style="display:inline-block;width:15px;height:15px;background:${respColor};margin-right:4px;"></span>${this.core.translate("Responses")}
    `;
  }
}
