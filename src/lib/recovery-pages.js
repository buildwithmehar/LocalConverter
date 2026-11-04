export const recoveryPages = {
  400: {
    code: '400',
    title: 'The request could not be understood',
    intro: 'Some information needed for this action is missing or invalid.',
    reason:
      'A conversion needs a supported source-and-output pair and valid settings. An incomplete request, an old page state or a value outside an option’s range can prevent the app from starting the operation.',
    steps: [
      [
        'Return to the converter',
        'Use the current file controls instead of editing a temporary request or download address.',
      ],
      [
        'Review the selected options',
        'Choose a compatible output and start with the defaults. Save valid settings for the affected file.',
      ],
      [
        'Try the action again',
        'If the request still fails, read the job’s message and check the help center. Preserve the original and any other completed results.',
      ],
    ],
    primary: ['Open the converter', '/'],
    related: ['/help', '/formats', '/how-it-works'],
  },
  401: {
    code: '401',
    title: 'This local session is unavailable',
    intro: 'The browser no longer has an active session for this request.',
    reason:
      'The running local service uses a browser cookie to identify the workspace. A server restart, expired session or cleared browser data can make an earlier session unavailable. This app does not have an account sign-in that restores an old temporary workspace.',
    steps: [
      [
        'Check the current address',
        'Continue in the same browser and local address where you selected the files. Another browser or private window has separate session data.',
      ],
      [
        'Save what remains accessible',
        'Look for downloaded copies and keep the original files. Avoid clearing storage while results are still available.',
      ],
      [
        'Start a new workspace if needed',
        'If the previous session has ended, choose the originals again. Restarting a session cannot recreate temporary outputs that have already been removed.',
      ],
    ],
    primary: ['Read session help', '/help'],
    related: ['/privacy', '/security', '/'],
  },
  409: {
    code: '409',
    title: 'This file is not ready for that action',
    intro: 'The current job state does not allow the requested operation.',
    reason:
      'A download requires a completed output. A queued, processing, failed or cancelled job is in a different state, and an old button or temporary link may no longer describe what the server can provide.',
    steps: [
      [
        'Check the file status',
        'Wait for a real completed state before downloading. A processing label without a percentage is not an estimate of time remaining.',
      ],
      [
        'Use the appropriate control',
        'Cancel work you no longer need, or read the failure message before using Retry. Do not treat an unavailable download as a finished result.',
      ],
      [
        'Return to your workspace',
        'My files shows the current session’s jobs. Save completed results separately from the file that still needs attention.',
      ],
    ],
    primary: ['Read file-status help', '/help'],
    related: ['/how-it-works', '/privacy', '/'],
  },
  404: {
    code: '404',
    title: 'Page not found',
    intro: 'This address does not match an available page.',
    reason:
      'The link may be incomplete, an address may have been typed differently, or the page may have moved. This does not mean that a selected file has failed to convert.',
    steps: [
      [
        'Check the address',
        'Look for a missing character or an extra part of the URL. Use the navigation above when you are unsure of the destination.',
      ],
      [
        'Choose a working destination',
        'Open the converter, browse supported formats or visit the help center. These links stay inside the app.',
      ],
      [
        'Return to your files',
        'If files are already selected, use My files to continue. Visiting another page inside the app keeps pending selections in this tab.',
      ],
    ],
    primary: ['Back to converter', '/'],
    related: ['/formats', '/tools', '/help'],
  },
  unsupported: {
    code: 'FORMAT',
    title: 'Conversion unavailable',
    intro: 'This conversion is not supported by the tools installed on this computer.',
    reason:
      'The app only offers source-and-output pairs reported by its local conversion tools. A filename extension alone cannot make another conversion available, and a similarly named converter may produce a different kind of result.',
    steps: [
      [
        'Start with the source format',
        'Find the original file type in Supported formats. Its available outputs are listed beside it.',
      ],
      [
        'Choose an output for your destination',
        'Decide whether you need an image, editable text, a table or media. Read the converter’s limits before selecting a substitute.',
      ],
      [
        'Keep the original',
        'Changing a filename extension does not convert its contents. Preserve the source and use a supported converter or the application that created it.',
      ],
    ],
    primary: ['View supported formats', '/formats'],
    related: ['/tools', '/how-it-works', '/help'],
  },
  403: {
    code: '403',
    title: 'Access is unavailable',
    intro: 'This request cannot access the current local session.',
    reason:
      'The local app checks its address, the browser session and requests that change files. A result from another session, a link opened under a different local address, or a request from another website may not have access.',
    steps: [
      [
        'Use the same local address',
        'Continue in the address where you selected the file. localhost and 127.0.0.1 can have separate browser sessions.',
      ],
      [
        'Open your workspace',
        'Use My files in this tab to find results belonging to the current session. Do not share temporary download links as permanent file links.',
      ],
      [
        'Start again only when necessary',
        'Save accessible results first. If a session has ended, choose the original file again instead of trying to bypass the access check.',
      ],
    ],
    primary: ['Open help center', '/help'],
    related: ['/security', '/privacy', '/'],
  },
  408: {
    code: '408',
    title: 'The request took too long',
    intro: 'The operation did not finish within its allowed time.',
    reason:
      'Large inputs, complex documents and media encoders can need more work than a smaller file. A timeout is not a reliable measure of file quality, and retrying the same input with the same settings may reach the same limit.',
    steps: [
      [
        'Read the file’s message',
        'A failed job includes its own explanation. Distinguish a connection timeout from an engine that stopped processing.',
      ],
      [
        'Try a representative input',
        'Keep the original and test a smaller export or simpler settings. Check that it opens correctly before selecting it.',
      ],
      [
        'Retry deliberately',
        'Keep the local server running. Retry one file and review its result before submitting the rest of the batch again.',
      ],
    ],
    primary: ['Find troubleshooting help', '/help'],
    related: ['/how-it-works', '/tools', '/'],
  },
  410: {
    code: '410',
    title: 'This result is no longer available',
    intro: 'The temporary output has expired or has been removed.',
    reason:
      'Local Converter keeps working copies for a limited time. Clearing a workspace, removing a file or restarting the local server can also make an old download link unavailable. Copies already saved to your computer are separate.',
    steps: [
      [
        'Check your downloads',
        'Look in the folder selected by your browser. An expired temporary link does not delete a copy you downloaded earlier.',
      ],
      [
        'Convert the original again',
        'Choose the original file and use the same output if you need another copy. The app is not a permanent file archive.',
      ],
      [
        'Save before leaving',
        'Download completed results promptly. Use Download all when you want a ZIP of the finished files in the current view.',
      ],
    ],
    primary: ['Convert a file again', '/'],
    related: ['/help', '/privacy', '/how-it-works'],
  },
  413: {
    code: '413',
    title: 'This file is too large',
    intro: 'The input is above the size accepted by the local workspace.',
    reason:
      'File limits keep temporary storage and conversion work bounded. A file above the limit is rejected before it is added to the queue; repeatedly selecting the same file does not increase that limit.',
    steps: [
      [
        'Check the current limit',
        'The upload area and help center show the size allowed per file. A batch limit and a per-file limit are different checks.',
      ],
      [
        'Export a smaller source',
        'Use the application that created the file to reduce unnecessary pages, dimensions or media length. Keep an unchanged original.',
      ],
      [
        'Try one file first',
        'Select the smaller copy and confirm the output suits your destination before preparing the remainder of the batch.',
      ],
    ],
    primary: ['Review file limits', '/help'],
    related: ['/formats', '/how-it-works', '/'],
  },
  415: {
    code: '415',
    title: 'File type not supported',
    intro: 'The installed tools do not offer a suitable conversion for this file type.',
    reason:
      'Some formats need applications or engines that are not installed here. Renaming an extension can make a file look supported while leaving its contents unchanged, so it is not a reliable workaround.',
    steps: [
      [
        'Confirm the original format',
        'Check the export settings in the source application. If the filename and contents do not match, export a fresh copy.',
      ],
      [
        'Browse available formats',
        'The format directory lists what the current tools report. The output picker includes compatible choices for the selected source.',
      ],
      [
        'Use an intermediate export carefully',
        'If the original application can export a supported format, review what that export preserves. An intermediate conversion may discard information.',
      ],
    ],
    primary: ['Browse supported formats', '/formats'],
    related: ['/tools', '/help', '/'],
  },
  422: {
    code: '422',
    title: 'The file could not be read',
    intro: 'The converter could not process the contents of this input.',
    reason:
      'A damaged, empty, encrypted or incorrectly labelled file may be unreadable even when its extension is supported. The error beside the file is the best starting point for understanding the specific failure.',
    steps: [
      [
        'Open the original',
        'Check it in the application that normally handles it. A converter is not a repair tool for every damaged document or media file.',
      ],
      [
        'Export a clean copy',
        'If the source app can open the file, save or export another copy. For protected files, use an export you are authorized to create.',
      ],
      [
        'Use supported settings',
        'Try defaults and one representative file. Read the converter’s limitations before expecting layouts, formulas, transparency or metadata to survive.',
      ],
    ],
    primary: ['Troubleshoot this file', '/help'],
    related: ['/formats', '/how-it-works', '/'],
  },
  429: {
    code: '429',
    title: 'The workspace needs some room',
    intro: 'A file or request limit has been reached.',
    reason:
      'The app bounds the number of files in a session and runs conversions one at a time. This is a local resource limit; opening more browser tabs is not a useful way to give a large batch more capacity.',
    steps: [
      [
        'Save completed results',
        'Download any finished files you need before removing them from the workspace.',
      ],
      [
        'Remove finished or unwanted files',
        'Make room using individual Remove controls. Clear all is appropriate only when you no longer need the temporary copies in that view.',
      ],
      [
        'Continue in smaller batches',
        'Add more files after the first set is saved. Use the limits shown by the app rather than submitting the same request repeatedly.',
      ],
    ],
    primary: ['Open conversion help', '/help'],
    related: ['/how-it-works', '/privacy', '/'],
  },
  500: {
    code: '500',
    title: 'Something interrupted this page',
    intro: 'The app could not finish the current operation.',
    reason:
      'An unexpected application or local processing error can interrupt a request. The original file is separate from the app’s temporary working copy. A finished message or a download button is required before treating a conversion as complete.',
    steps: [
      [
        'Check the workspace first',
        'Use My files if files are already selected. Save any finished results that remain accessible.',
      ],
      [
        'Try the operation once more',
        'Use the retry action when available. If the same file fails again, read its error and try defaults or a clean source export.',
      ],
      [
        'Use the help center',
        'Review connection, format and download guidance. Restart the local app only after saving results you need and considering pending selections.',
      ],
    ],
    primary: ['Open help center', '/help'],
    related: ['/', '/tools', '/security'],
  },
  503: {
    code: '503',
    title: 'Local server unavailable',
    intro: 'The browser cannot use the local conversion service right now.',
    reason:
      'The website interface and the conversion server work together on this computer. The server needs to stay running while files are processed and downloaded. A server that is starting, stopped or shutting down cannot finish new requests.',
    steps: [
      [
        'Check the local app',
        'Start Local Converter from its installation folder and keep its process running. Wait for the local address to be ready.',
      ],
      [
        'Retry the connection',
        'Use Try connection again when it is shown. This checks the local service without automatically reloading the tab.',
      ],
      [
        'Keep important files available',
        'Pending selections live in the browser tab. Save accessible results before closing the tab or restarting the app.',
      ],
    ],
    primary: ['Open connection help', '/help'],
    related: ['/how-it-works', '/security', '/'],
  },
  offline: {
    code: 'LOCAL',
    title: 'Local server unavailable',
    intro: 'The interface is open, but its connection to this computer’s converter is unavailable.',
    reason:
      'The app uses a local server, not a remote conversion account. Losing this connection does not necessarily mean that your internet connection is down. The server can be stopped even while other websites still load normally.',
    steps: [
      [
        'Start Local Converter',
        'Open the app’s startup shortcut or start it from its installation folder. Keep the local process running while you work.',
      ],
      [
        'Stay in this tab',
        'Avoid reloading while files are selected. Pending files are held in the browser, while temporary results depend on the running server.',
      ],
      [
        'Check the connection again',
        'Use the connection retry action. If it still fails, read the connection details and visit Help for startup guidance.',
      ],
    ],
    primary: ['Open connection help', '/help'],
    related: ['/how-it-works', '/privacy', '/'],
  },
};

export const recoveryRoutes = Object.fromEntries(
  Object.entries(recoveryPages)
    .filter(([key]) => key !== 'unsupported')
    .map(([key, page]) => [`/${key}`, { ...page, kind: key }]),
);
export const recoveryLinkNames = {
  '/': 'File converter',
  '/formats': 'Supported formats',
  '/tools': 'Local tools',
  '/help': 'Help center',
  '/how-it-works': 'How it works',
  '/security': 'Data security',
  '/privacy': 'Privacy',
};
