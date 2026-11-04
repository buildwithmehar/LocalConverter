import { browserPolicyContent } from './browser-policy-content.js';
import { bytes } from './formats.js';

export function policyContent(route, registry) {
  if (registry.mode === 'browser') return browserPolicyContent(route, registry);
  const minutes = registry.limits?.retentionMinutes || 30,
    maxFiles = registry.limits?.maxFiles || 20,
    maxBytes = bytes(registry.limits?.maxBytes || 104857600);
  const commonRetention = `Temporary copies normally expire after ${minutes} minutes of inactivity, with cleanup running periodically. Downloading a completed result refreshes its temporary lifetime. Removing a file or clearing its workspace can delete those working copies sooner.`;
  const pages = {
    '/security': {
      title: 'Data security',
      intro:
        'Understand the file journey, the protections around the local service and the practical limits of processing files on your own computer.',
      icon: 'security',
      summary: 'A short journey, with clear boundaries.',
      facts: [
        ['Processing', 'On this computer'],
        ['Input size', `${maxBytes} per file`],
        ['Temporary results', `${minutes} minutes`],
      ],
      sections: [
        {
          id: 'processing',
          title: 'Where conversion happens',
          paragraphs: [
            'The browser is the workspace. When you press Convert, it sends the selected file to the app’s local server at 127.0.0.1. An installed conversion engine reads that temporary copy and writes an output. The browser then downloads the result from the same local service. A remote conversion provider is not part of this workflow.',
            'Your original file stays in its existing location. The converter does not need to replace it to create an output. Downloading the result gives you a separate copy, which you can review and save in the folder that suits your work. Keep the original until you have checked the converted file.',
          ],
        },
        {
          id: 'local-access',
          title: 'The local service boundary',
          paragraphs: [
            'The default server listens on this computer’s loopback address. Other devices on the network cannot connect through that default listener. Requests are checked against the app’s own local host and port, and cross-origin requests are rejected. The production interface uses files, fonts and scripts served by this local app.',
            'These checks describe the default installation. They are not a claim that this computer is isolated from every other process or user account. Software running under your account may have access to local files. Keep the operating system, browser and conversion tools updated, and avoid exposing the service through a public tunnel without a separate deployment design.',
          ],
        },
        {
          id: 'sessions',
          title: 'A workspace belongs to its browser session',
          paragraphs: [
            'A session cookie separates conversion jobs between browser sessions. Requests that change jobs also carry a session-specific token. A result is available only to its owning session; knowing a temporary file identifier is not enough to download another session’s output through the app.',
            'The addresses localhost and 127.0.0.1 can have separate browser storage and cookies. Continue using the address where you started. Opening an old download link in another browser, private window or new session may fail because that context does not own the job. Save a normal downloaded file when you need a copy that can be opened elsewhere.',
          ],
        },
        {
          id: 'temporary-storage',
          title: 'Working copies have a limited lifetime',
          paragraphs: [
            commonRetention,
            'The local server keeps working data in its application data directory. Restarting the service resets its session state and clears previous temporary job folders during startup. Temporary storage is designed for active conversion, not backup. A saved browser download is independent of those folders and remains wherever you downloaded it.',
          ],
        },
        {
          id: 'resource-limits',
          title: 'Limits keep work bounded',
          paragraphs: [
            `The workspace accepts up to ${maxFiles} files per session, with a maximum input size of ${maxBytes} each. The server runs one conversion at a time and also bounds execution time and output size. These controls reduce unbounded queues and resource use; they do not guarantee that every accepted file can be decoded.`,
            'A compressed archive can expand into much more data, and a complex document or media file can require more memory than its size suggests. Read any error shown beside the job. For a large batch, test one representative file first, save its result, and continue in smaller groups rather than repeatedly resubmitting the same failing request.',
          ],
        },
        {
          id: 'trusted-inputs',
          title: 'Local processing is not a file safety guarantee',
          paragraphs: [
            'File parsers and native tools run under your operating system account. The app uses a separate worker process for conversion, but that is not a virtual machine or a complete hostile-file sandbox. A file can be malformed or deliberately crafted even when its extension is supported.',
            'Use inputs from sources you trust and keep the underlying tools updated. The app does not advertise malware scanning, encrypted temporary storage or secure disk erasure. If your work requires a managed environment with additional controls, evaluate those requirements separately before selecting sensitive or untrusted files.',
          ],
        },
        {
          id: 'downloads',
          title: 'Review the output before using it',
          paragraphs: [
            'A completed status means that an engine produced an output. It does not verify every word, pixel, formula or metadata field against the original. Different formats preserve different features, and a successful conversion may flatten transparency, extract text instead of layout, or turn formulas into values.',
            'Open the saved result in its intended application and compare representative details. Check filenames, page order, table columns, image dimensions or audio content as appropriate. Keep important originals and use the converter’s format-specific notes when choosing an output for work where fidelity matters.',
          ],
        },
      ],
      related: [
        ['/privacy', 'Read the privacy details'],
        ['/help', 'Get conversion help'],
        ['/how-it-works', 'Follow the file journey'],
      ],
    },
    '/privacy': {
      title: 'Privacy',
      intro:
        'What the local app reads, what it stores temporarily and what stays in your browser. This page describes the version running on this computer.',
      icon: 'privacy',
      summary: 'Know which copy lives where.',
      facts: [
        ['Account', 'Not required'],
        ['Theme preference', 'Stored in this browser'],
        ['Conversion service', 'Local server'],
      ],
      data: [
        [
          'Selected files',
          'Held by the browser until you submit a conversion. Pending selections do not survive a full tab reload or close.',
        ],
        [
          'Working inputs and outputs',
          `Stored by the local server for conversion and download, subject to the ${minutes}-minute temporary retention policy.`,
        ],
        [
          'Names, formats and settings',
          'Used to display the queue, choose the engine and name the output. They remain part of the temporary job.',
        ],
        [
          'Session cookie',
          'Separates job ownership within the running local service. Inactive server sessions are removed after about eight hours.',
        ],
        [
          'Theme preference',
          'Saved in local storage until you change it or clear this site’s browser data.',
        ],
      ],
      sections: [
        {
          id: 'selected-files',
          title: 'Selecting and submitting a file',
          paragraphs: [
            'The browser gives the app access to files you select through its picker or drop into the upload area. Selecting a file creates a pending item in the current tab. The app reads its name, size and extension to choose compatible conversion options. It does not search unrelated folders on your computer.',
            'Pressing Convert uploads the selected content to the app’s local server on this same computer. The conversion engine works on a temporary copy rather than changing the original. Browsing to another page inside the app keeps pending selections in the current tab; closing or fully reloading that tab removes those browser-held selections.',
          ],
        },
        {
          id: 'job-information',
          title: 'Information used for the conversion',
          paragraphs: [
            'A job includes the original display name, file size, selected source and output formats, conversion options, status and any processing error. A completed job also includes the output name and size. The browser uses this information to show progress, explain failures and provide the correct download.',
            'Temporary server filenames are generated by the app. Your original display name may still appear in the interface, output filename or error text, so consider what the name itself reveals when working on a shared screen. Error information is intended to help you recover; a failed conversion is not proof that no temporary copy was ever created.',
          ],
        },
        {
          id: 'retention',
          title: 'Temporary storage and removal',
          paragraphs: [
            commonRetention,
            'The app does not provide a permanent archive of past jobs. Restarting the local server resets its sessions and removes previous working folders during startup. Browser downloads are different files: once saved, they remain in the folder you chose and are not removed by the app’s temporary cleanup. Your unchanged originals remain in their existing locations as well.',
          ],
        },
        {
          id: 'browser-data',
          title: 'Cookies and browser preferences',
          paragraphs: [
            'A first-party session cookie identifies the browser session to the running local server. It is marked HttpOnly and SameSite Strict. Requests that add, remove, cancel or retry jobs also use a token tied to that session. These mechanisms support workspace separation; they are not a sign-in account or an identity profile.',
            'The selected light or dark theme is saved in this browser’s local storage. Clearing site data can reset the preference and remove the cookie that gives access to the current session’s jobs. Before clearing browser storage, save results you need. Browser history and downloaded files are managed separately by your browser and operating system.',
          ],
        },
        {
          id: 'network',
          title: 'Network requests and external links',
          paragraphs: [
            'The local conversion workflow does not send file contents to a third-party conversion service. The production app bundles its interface assets and fonts locally. It does not include advertising cookies, usage analytics, cloud-storage imports or a remote account system. It still makes requests between the browser and the local server.',
            'Some credits and license references link to external websites. Following one leaves the local app, and the destination has its own practices. The app does not need those sites to process a supported file after setup. Installing or updating the application and its dependencies can involve network activity outside the running converter’s workflow.',
          ],
        },
        {
          id: 'your-controls',
          title: 'Controls available in the workspace',
          paragraphs: [
            'You decide which files to select, which compatible output to use and where to save a completed download. Remove an individual item when you no longer need its working copy, or use Clear all for the current workspace view. Save needed outputs before using either action. A browser-held pending selection can also be removed before submission.',
            'Cancelling a job stops a queued or running conversion; it is not the same as deleting every copy of the file. Read the resulting job state and remove the item when appropriate. If a file or result is unavailable, use the help center to distinguish session access, expiry and format problems before submitting another copy.',
          ],
        },
        {
          id: 'shared-computers',
          title: 'Using a shared computer',
          paragraphs: [
            'Downloaded files, browser history, application data folders and other local processes are subject to the controls of the computer you are using. Local processing does not make an unmanaged machine a private environment. Choose a suitable device and account for the sensitivity of the material you intend to convert.',
            'Before leaving a shared workstation, save results in an appropriate location, remove temporary jobs you no longer need and close the app when your work is complete. Ordinary cleanup is not a guarantee of forensic erasure. This page describes the app’s local workflow and should not be read as a promise about every device, backup or browser extension around it.',
          ],
        },
      ],
      related: [
        ['/security', 'Understand the local service'],
        ['/help', 'Manage files and downloads'],
        ['/terms', 'Read the terms of use'],
      ],
    },
    '/terms': {
      title: 'Terms of use',
      intro:
        'Practical conditions for using Local Converter, understanding its limits and working responsibly with the files it produces.',
      icon: 'terms',
      summary: 'Keep the source. Understand the output.',
      facts: [
        ['Product', 'Independent local application'],
        ['Availability', 'Installed tools determine support'],
        ['Results', 'Review before use'],
      ],
      sections: [
        {
          id: 'using-the-app',
          title: 'Using the local application',
          paragraphs: [
            'Local Converter is an independent file conversion application that runs through a browser interface and local conversion tools. These terms describe that local version. Access to the interface does not create a hosted storage account, a conversion subscription or a promise that a remote processing service is available.',
            'Use the app through its normal interface and keep the local server running while conversions and downloads are in progress. The app’s address, session checks and resource limits are part of its operation. Do not treat a temporary result URL as a permanent public sharing link or attempt to access another browser session’s jobs.',
          ],
        },
        {
          id: 'your-material',
          title: 'Files you choose to process',
          paragraphs: [
            'Only select material you are authorized to copy, transform and use. Converting a file does not grant rights in its text, images, audio, video, software or other contents. Consider any restrictions that apply to the original material and to the destination where you intend to use the result.',
            'Keep important originals and choose a suitable computer for the material you are processing. The app works on temporary copies, but downloaded files and the original source remain under your control. You are responsible for reviewing the input, deciding which output is appropriate and managing copies after they have been saved.',
          ],
        },
        {
          id: 'supported-conversions',
          title: 'Supported formats and installed tools',
          paragraphs: [
            'Available conversions are determined by the app’s registry and the tools installed on this computer. A format appearing in the directory means that a tool reports support for a conversion route; it does not mean that every file using that extension, every internal feature or every protected variant can be processed.',
            'Converters may have different options and limitations. Some outputs preserve images, some extract text or tabular values, and some package multiple results in an archive. Read the notes on the specific converter page. Renaming an extension does not change file contents and does not add support for an unavailable conversion.',
          ],
        },
        {
          id: 'fidelity',
          title: 'Output quality and verification',
          paragraphs: [
            'Formats are not interchangeable containers. Conversion may change document layout, image transparency, metadata, media quality, formulas, links, embedded objects or other advanced features. A completed job means that the local engine created an output; it is not a guarantee of exact equivalence to the source.',
            'Open the saved result in the application where it will be used. Compare representative pages, values, dimensions, timing or other relevant details before publishing, sharing or relying on it. For material where a particular feature matters, use an output and workflow that explicitly preserve that feature rather than assuming that a successful status proves it survived.',
          ],
        },
        {
          id: 'limits-and-errors',
          title: 'Limits, interruptions and failed work',
          paragraphs: [
            `The current local workspace accepts up to ${maxFiles} files, with an input limit of ${maxBytes} each. The server runs work one file at a time and bounds conversion time and output size. Limits can prevent a request from starting or cause an operation to stop before an output is ready.`,
            'The application and conversion tools are provided as is. Unavailable tools, damaged files, resource pressure, unsupported features and software errors can interrupt processing. Read the message beside the affected file, keep an original copy and use a controlled retry. Repeated requests or extra tabs do not remove the underlying limit.',
          ],
        },
        {
          id: 'temporary-results',
          title: 'Temporary results and saved downloads',
          paragraphs: [
            commonRetention,
            'Restarting the server resets the local session state and can make earlier result links unavailable. Download files you need while they are available. A saved download remains in its selected folder independently of the app’s temporary storage. Local Converter is a working utility, not a backup system or a permanent record of your conversions.',
          ],
        },
        {
          id: 'safety-and-access',
          title: 'Local access and file safety',
          paragraphs: [
            'The default service accepts connections through this computer’s loopback address and applies session ownership and request checks. These measures are intended for the local workflow. They do not create an isolated operating system, guarantee that a file is safe, or protect a device from every other process running under the same user account.',
            'Use files from sources you trust, keep software updated and follow any rules that apply to the computer or organization where you work. Do not bypass access checks or expose the local service to other users as though it were a production hosting platform. Read Data security for the actual boundaries of the implementation.',
          ],
        },
        {
          id: 'licenses',
          title: 'Names, components and licenses',
          paragraphs: [
            'Local Converter uses third-party libraries, file icons and installed conversion engines. Their licenses and notices continue to apply to those components. Referenced product names belong to their respective owners. The About page links to interface and icon attribution, and the project’s dependency information identifies tools used by this installation.',
            'These terms do not grant permission to disregard a component license or a restriction attached to material you convert. If you redistribute, modify or deploy a copy of the app, review the relevant notices and the behaviour of that version. A different deployment may need different operational information from this computer-only edition.',
          ],
        },
      ],
      related: [
        ['/about', 'Read about Local Converter'],
        ['/privacy', 'Understand file handling'],
        ['/security', 'Review processing boundaries'],
      ],
    },
  };
  return pages[route];
}
