# AutoStartFlow v1.0.3

[**Download AutoStartFlow v1.0.3**](https://github.com/delno003/AutoStartFlow/raw/refs/heads/main/AutoStartFlow-v1.0.3.zip)

Extract the complete ZIP and run **AutoStartFlow Setup.exe** inside the AutoStartFlow folder.

**Updating:** Close MSFS and AutoStartFlow, run Setup from the new download, choose **Update**, and select the existing installed AutoStartFlow folder. Update keeps settings, apps, configurations, profiles, and EXE.xml.

***Launch, sequence, and manage your MSFS companion apps in one place.***

### What is AutoStartFlow?

If you fly with companion software, such as an EFB, a flight tracker, a VATSIM or IVAO client, a SimConnect utility, or a streaming tool, you’ve probably wanted those apps to start on their own when the simulator loads. MSFS can do this through a file called EXE.xml, but editing it by hand means digging through hidden folders and more room to make typos and syntax errors.

AutoStartFlow replaces that with a simple interface. Add your apps, choose when and how each one starts, and AutoStartFlow handles EXE.xml for you. It’s free, standalone, and works with MSFS 2024 (and MSFS 2020).

### Features

- **Sequence your apps** - Set the exact order your applications start in. This is useful when one tool needs another to be running first.
- **Choose when each app launches** - You can choose a startup trigger for every app individually. Either launch an app when MSFS starts (via EXE.xml), when you spawn into your aircraft (useful for addons that require you to first load into the airport, such as REX Atmos Core), or when you turn on your PC (Windows startup apps).
- **Pick the monitor** - Choose which display/monitor each application opens on. This is handy on multi-monitor setups, such as an EFB on a side screen and a tracker on another.
- **Auto-close with the sim (’Flight Watch’)** - Select which applications should close automatically when you close MSFS.
- **Remember your layout** - AutoStartFlow automatically saves the screen positions of your companion apps. The next time you launch the simulator, every standalone application opens right where you left it. No manual repositioning, no hassle, simply pick up where you left off.
- **Enable/Disable addons** - You can choose to enable or disable specific, or all addons with a simple button click. This will allow you to fly without specific addon(s) while still keeping it in the ‘Startup apps’ list.
- **Create custom startup profiles** - Save different setups for streaming, VATSIM, or other flight scenarios. Each profile remembers your enabled apps, launch order and moments, displays, window positions, and auto-close settings. Switch profiles with a simple click, or create, edit, duplicate, and delete them whenever you need.
- **Launch documents, images, and websites** - Apart from executables (EXE) and shortcuts (INK), you can add PDF checklists, PNG/JPEG images, website links, and other file types alongside your companion apps, with the same launch moments, display selection, and other startup options. Documents and images open in your system’s default viewer, with your default browser used as a fallback if no viewer is available. Website links open in a new browser window, so placing them on another display won’t move your existing tabs.
- **Import your existing setup** - Already have apps in your EXE.xml? AutoStartFlow automatically imports them. You may also import them in one click. From then on, you can edit EXE.xml directly from the AutoStartFlow and all changes are applied in real time.
- **Sync in both directions -** If you move, delete, or lose your EXE.xml, AutoStartFlow can rebuild it from your saved configuration, so you don’t have to set everything up again.
- **Restore the original EXE.xml** - Before its first sync, AutoStartFlow saves a backup of your original EXE.xml. You can restore it from settings at any time if you want to go back to exactly how things were before you made any changes with AutoStartFlow.
- **Import/Export configurations** - You can export the modified EXE.xml and settings.json to share with others, or import configurations you or other pilots have created.

### Settings

- **Appearance** - Dark, light, or automatic (switches based on the time of day). Dark by default.
- **Flight Watch** - This is the feature that closes your selected apps when MSFS closes. It is on by default and requires AutoStartFlow to be running. Of course, you can individually select which applications use this feature. If you don’t need auto-close at all, you can turn Flight Watch off.
- **Launch with MSFS** - Adds AutoStartFlow itself to EXE.xml, so it starts automatically with the simulator. This is required for the ‘Flight Watch’ feature. On by default.
- **Launch when Windows starts** - Starts AutoStartFlow when you turn on your device. This is an alternative startup method to the setting mentioned above (also used for ‘Flight Watch’, you can only select one launch method).
- **Close AutoStartFlow when MSFS closes** - Automatically exits AutoStartFlow once the simulator closes.
- **Launch with administrator privileges** - Launches AutoStartFlow with elevated privileges. This allows control of companion apps, so Windows no longer prompts you before opening every companion app. You are just prompted once on AutoStartFlow launch. On by default.
- **Minimize to system tray - ‘**Off’ option keeps AutoStartFlow running as it is. ‘On MSFS launch’ minimizes AutoStartFlow to system tray when the simulator launches.  ‘On application open’ minimizes AutoStartFlow to system tray when it is opened. This way, ‘Flight Watch’ keeps working while it stays out of sight.
- **Sync startup apps to EXE.xml** - ****Syncs AutoStartFlow with EXE.xml. In other words, writes the current AutoStartFlow configuration into the EXE.xml file. This should only be used if the EXE.xml was manually modified or moved to a different location. In all other cases, the sync is done automatically.
- **Restore original EXE.xml** - ****Reverts to the backup EXE.xml file captured the first time you synced with AutoStartFlow (before AutoStartFlow ever made any changes).

### How it works

1. Open AutoStartFlow and set your simulator profile and EXE.xml location.
2. Import your existing apps, or add new ones.
3. Set the order, launch trigger, monitor, and auto-close option for each app.
4. Launch MSFS. Your apps start automatically.

### Installation **& Usage:**

- AutoStartFlow is a standalone application and can run from anywhere on your disk. It is **highly discouraged** to place it in your community folder. **Simply install it to a location of your choice and run ‘AutoStartFlow Setup.exe’.** There, it will ask you for the installation path. You only run ‘AutoStartFlow Setup.exe’ on first install, update, or uninstall. Once you are done with the setup, launch AutoStartFlow and manage your addons. If there is a new update, you run the setup executable again, press update and choose the path where AutoStartFlow is installed.
- AutoStartFlow requires to be ran alongside MSFS in order to use the ‘Flight Watch’ feature. This feature is responsible for closing the apps when you quit MSFS. There is an option in settings to launch AutoStartFlow along with MSFS so you do not have to worry about launching another standalone application. You may also additionally tick the recommended ‘minimize to system tray on startup’ setting, so you won’t even see AutoStartFlow running visually. This way, AutoStartFlight will start automatically, quietly run in the background, and close as soon as you close the simulator. No more extra clicks and hassle.
- If you have any problems understanding buttons and functionality, simply hover over it to see a useful tooltip. If you still need further assistance, please make sure to join the discord server indicated in the limitations section in this document.

### Compatibility

- MSFS 2024 (Microsoft Store and Steam) and MSFS 2020
- Windows only

### Known Limitations & Future Work

- The loading times of the startup applications depend on how MSFS24 reads the EXE.xml data, so it may take up to a few minutes. However, addons (ones selected ‘on MSFS startup’) should all be loaded once the simulator loading screen completes. The ones selected as ‘on Aircraft loads’ are loaded once your aircraft spawns in an airport.
- The Launch moments are currently limited to four options (’Windows sign-in’, ‘When MSFS starts’, ‘On aircraft load’, ‘Close only’). There are plans to add advanced customizable launch moments (such as starting an application 2 minutes after the one before, launching on engine shutdown, and much more).
- AutoStartFlow is designed to be as simple and as intuitive as possible. This also means that it does not contain features vast majority of users aren’t going to use. Therefore, new features are added depending on the requests, demand, and use case variety. To help us understand this (in addition to reporting bugs, making requests, joining events, or simply being part of a  community), feel free to join the **discord server**: https://discord.gg/EjFtMeF9Sm

### Changelog

- v1.0.4 (unreleased):
    - Fixed setup failing when an imported EXE.xml entry points to a missing companion app. Unavailable entries are retained disabled so their paths can be corrected after installation.
    - Fixed the clean-install confirmation blocking retries after an incomplete installation.
- v1.0.3:
    - Fixed AutoStartFlow Setup window not opening centered on screen.
    - Added an option to enable or disable saved window positions for individual apps.
    - Added a toggle to apply checkbox settings to all companion apps.
    - Added customizable launch delays of up to 300 seconds between apps.
    - Added in-app notifications for new releases, with a direct link to Flightsim.to.
- v1.0.2:
    - Fixed apps set to ‘After aircraft loads’ launching prematurely in the MSFS menu.
    - Fixed inconsistent startup timing when AutoStartFlow was already open. Startup apps now wait for MSFS to process EXE.xml.
    - Fixed app statuses remaining stuck on ‘Launching…’ while MSFS was loading.
- v1.0.1:
    - Fixed a critical error where ‘AutoStartFlow Setup.exe’ and ‘AutoStartFlow.exe’ failed to launch on some Windows systems.
    - Added a startup indicator while the application loads.
    - Improved Windows startup error messages.
- v1.0.0:
    - Initial release.

[Previous release: v1.0.2](https://github.com/delno003/AutoStartFlow/releases/tag/v1.0.2) · [v1.0.1](https://github.com/delno003/AutoStartFlow/tree/v1.0.1) · [v1.0.0](https://github.com/delno003/AutoStartFlow/tree/v1.0.0)
