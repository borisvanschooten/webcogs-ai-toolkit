export default class MainMenuPlugin {
    constructor(core) {
        this.core = core;
        // HTML for the nav bar menu
        const html = `
            <nav class="menu">
                <div class="menu-left">
                    <button id="usersBtn" class="menu-btn" type="button">Users</button>
                    <button id="ticketsBtn" class="menu-btn" type="button">Tickets</button>
                </div>
                <div class="menu-right">
                    <button id="logoutBtn" class="menu-btn" type="button">Logout</button>
                </div>
            </nav>
        `;

        // CSS for the nav bar menu
        const css = `
            .menu {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                box-sizing: border-box;
                padding: 0.5rem 1rem;
                background-color: #f1f1f1;
                border-bottom: 1px solid #ccc;
                font-family: Arial, sans-serif;
            }
            .menu-left, .menu-right {
                display: flex;
                align-items: center;
            }
            .menu-btn {
                background: none;
                border: none;
                padding: 0.5rem 1rem;
                margin: 0;
                font-size: 1rem;
                cursor: pointer;
                color: #333;
            }
            .menu-btn:hover {
                background-color: #e0e0e0;
            }
        `;

        // Mount the UI in the nav_bar location
        const root = this.core.mount('nav_bar', html, css);

        // Attach event listeners
        root.getElementById('usersBtn').addEventListener('click', () => {
            this.core.route('useradmin');
        });

        root.getElementById('ticketsBtn').addEventListener('click', () => {
            this.core.route('ticketadmin');
        });

        root.getElementById('logoutBtn').addEventListener('click', () => {
            this.core.route('logout');
        });
    }
}