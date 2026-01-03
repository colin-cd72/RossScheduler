# Ross Scheduler

A cross-platform desktop application for scheduling commands to Ross Xpression machines and Ross Ultrix routers.

## Features

- **Device Management**: Configure multiple Ross Xpression machines and Ultrix routers
- **Named Routing**: Define friendly names for Ultrix sources and destinations
- **Scheduling**: Create one-time or recurring schedules using cron expressions
- **Manual Control**: Send Take IDs or route commands manually
- **Command History**: Full logging of all commands with export capability

## Protocols

- **RossTalk** (Xpression): TCP on port 7788, `TAKE <id>` commands
- **SW-P-08** (Ultrix): TCP on port 2000, Pro-Bel protocol for routing

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Build for specific platform
npm run build:mac
npm run build:win
```

## Building Executables

The app uses electron-builder to create installers:

- **macOS**: Creates `.dmg` and `.zip` files
- **Windows**: Creates NSIS installer and portable `.exe`

## Tech Stack

- Electron 28
- React 18 + TypeScript
- Tailwind CSS
- Zustand (state management)
- node-schedule (cron scheduling)

## License

MIT
