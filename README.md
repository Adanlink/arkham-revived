# Arkham: Revived

<img src="https://i.imgur.com/ACGb3uS.png" height="50%" width="50%">

A custom authentication server for Batman: Arkham Origins Online.

Supports user authentication and saving of player data.

Join the [Discord](https://discord.gg/rrwWcy82fr) for support, updates, and matchmaking.

## Table of Contents

- [Usage](#usage)
  - [Migration](#migration)
- [Setup](#setup)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Docker](#docker)
- [Features](#features)
  - [Message Of The Day](#message-of-the-day)
  - [Public Files](#public-files)
  - [Default Save File](#default-save-file)
  - [Database](#database)
  - [Matchmaking](#matchmaking)
  - [OAuth](#oauth)
  - [Security](#security)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## Usage

Follow these steps in order to play on Arkham: Revived.

1. Open the game directory for Batman: Arkham Origins through Steam.
2. Navigate through `Online/BmGame/Config/DefaultWBIDVars.ini` and open it in a text editor.
3. Find the following values:

    ```ini
    [GDHttp]
    BaseUrl="https://ozzypc-wbid.live.ws.fireteam.net/"
    EchoBaseURL="http://in.echo.fireteam.net/"
    WBIDTicketURL="https://tokenservice.psn.turbine.com/TokenService"
    WBIDAMSURL="https://cls.turbine.com/CLS"
    ClientId="REPLACE THIS WITH A RANDOM UUID"
    ClientIdSP="6ca97b4e-d278-48a4-8b66-80468447a513"
    ClientSecret="REPLACE THIS WITH A RANDOM ALPHANUMERICAL STRING"
    ClientSecretSP="AzyEBlZdY87HO3HINj7rqoBo7"
    EchoUsername="8b8f1d8554d5437b8cdf689082311680"
    EchoPassword="b3014aee79ba4968886003ecb271f764"
    Environment="Live"
    ```

4. Replace them with these values:

    ```ini
    [GDHttp]
    BaseUrl="http://[Source IP Address]:8080/"
    EchoBaseURL="http://in.echo.fireteam.net/"
    WBIDTicketURL="https://tokenservice.psn.turbine.com/TokenService"
    WBIDAMSURL="http://[Source IP Address]:8080/CLS"
    ClientId="0938aa7a-6682-4b90-a97d-90becbddb9ce"
    ClientIdSP="6ca97b4e-d278-48a4-8b66-80468447a513"
    ClientSecret="GXnNQaRSuxaxlm6uR35HVk39u"
    ClientSecretSP="AzyEBlZdY87HO3HINj7rqoBo7"
    EchoUsername="8b8f1d8554d5437b8cdf689082311680"
    EchoPassword="b3014aee79ba4968886003ecb271f764"
    Environment="Live"
    ```

    - Note: The `BaseUrl` and `WBIDAMSURL` values are the only ones that need to be changed. The port should match the `HTTP_PORT` you configure for the server (default is 8080).
    - You must obtain the source IP address of the server you're connecting to. This is usually found in the "Getting Started" section of the server's website.
    - You must generate a random UUID for the `ClientId`. You can use an online generator like [https://johnykvsky.github.io/uuid/](https://johnykvsky.github.io/uuid/).
    - You should also generate a random alphanumerical string for the `ClientSecret`.

5. Save the file and close it. This will allow the game to connect to Arkham: Revived.
6. Locate `SHARED.SWP` in your Steam Cloud storage directory. This is usually found in `C:\Program Files (x86)\Steam\userdata\[User ID]\209000\remote`.
    - You may obtain your user ID from [here](https://steamid.io/) as `steamID3`, removing the `[U:1` and `]` from the start and end of the ID respectively.
    - `209000` is the appid for Batman: Arkham Origins.
    - It is required to delete this file in order to unlink your WBID, as Arkham: Revived requires your game to ask for a new WBID.
7. Launch the game and make sure you've reached the main menu.
8. Close the game and re-launch it. This will ensure your account is linked to Steam.
9. Launch the game and click on **Store** in the main menu.
10. If your account was linked successfully, your display name will be shown as a store item.
11. You're now ready to play!

### Migration

> [!WARNING]
> As the official game servers are no longer online, the migration feature is non-functional. This section is kept for historical purposes only.

Migrating progress from official servers was previously possible by following these steps.

1. Follow the above steps and launch the game if you haven't already.
2. Take note of the price of the "Migrations" store option. This is the total number of migrations performed.
3. Click on "Store" in the main menu and click on "Migrate from official servers".
4. When asked to purchase, click yes. You will not be charged.
5. If an item you've earned says "Account migration process started", close the game and wait up to 5 minutes.
6. Launch the game and click on "Store" in the main menu.
7. If the "Migrations" store option's price increased by 1, your account has been migrated.
8. You're now ready to play with your existing ranks and XP!

## Setup

Setting up your own Arkham: Revived instance is straightforward.

There is no need to create your own instance, as an instance is already hosted at `arkham.kiwifruitdev.page` for public use.

### Requirements

- [Node.js](https://nodejs.org/en/) (v14.21.1 or later)
- [Git](https://git-scm.com/)

> [!NOTE]
> Previous versions of this server required Steam or Discord API keys. This is no longer the case. The server is self-contained.

### Installation

Use the following commands to install and run the server.

```bash
# Clone the repository
git clone https://github.com/KiwifruitDev/arkham-revived.git
cd arkham-revived

# Install dependencies
npm install
```

Then create a `.env` file from the example.

```bash
cp .env.example .env
```

You can edit the `.env` file to change the default port or other settings.

Now, start the server.

```bash
node .
```

### Docker

Alternatively, you can run the server using Docker.

```bash
# Build the docker image
docker build -t arkham-revived .

# Run the container
docker run -p 8080:8080 -d --name arkham-server arkham-revived
```

## Features

### Message Of The Day

![MOTD in-game](https://i.imgur.com/HUGcQkr.png)

On first run, `motd.json` will be generated in the root directory.

This file contains an array (max 10) of messages that will be displayed on the client-side.

### Public Files

This feature is not currently used. The `netvars.dat` file is now static and included in the `basecfg` directory.

### Default Save File

![Max level in-game](https://i.imgur.com/o2Ox5hb.png)

The default save file, `save.json`, is used for every client that connects to the server.

It's generated on first run, pulling from `defaultsave.json` in the root directory.

This file handles XP, levels, prestige, videos watched, tutorials, unlocks, loadouts, and game settings.

Players will automatically unlock Steam achievements when playing a match or prestiging, be careful.

The default json file skips tutorials and starts players at level 1 with all redemptions.

### Database

The server uses a SQLite database to store user information. The database file is created inside the `usercfg` directory.

Users are identified by their UUID, linked IP address, and Steam ID.

Only authenticated users are saved to the database.

### Matchmaking

Matchmaking is exclusively handled by Steam from observation.

A Steam lobby hosted on the same internet connection between players was tested, and the game was able to connect to it.

Theoretically, this server should allow Steam to connect players to each other as if this server was in a separate realm than the official server.

This means that players will only match with other players using this server, and vice versa.

Not much testing has been done with this feature, so it may not work as intended.

#### OAuth

This server does not re-implement Fireteam OAuth and its ticket system.

Instead, it generates per-session UUIDs determined by the ticket.

If the user's IP address is found in the database, the server will provide the linked UUID.

Otherwise, their data will not be saved.

### Security

The only security measure implemented is a private key used to seed UUIDs.

No other security measures are implemented, and the server is not intended to be used in a production environment.

Users cannot yet delete their data from the database, but this feature will be implemented in the future.

## Configuration

Configuration is now handled via environment variables. Create a `.env` file (you can copy `.env.example`) to override the default settings.

| Variable | Description | Default |
| --- | --- | --- |
| `HTTP_PORT` | The port for the HTTP server to listen on. | `8080` |
| `LOG_LEVEL` | The level of logging to display. Can be `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`. | `info` |
| `WIPE_DB_ON_START` | Set to `true` to wipe the user database on start. | `false` |


## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the [MIT License](https://choosealicense.com/licenses/mit/).
