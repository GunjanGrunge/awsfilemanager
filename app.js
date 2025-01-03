function showToast(message, type = 'info', duration = 3000) {
    const toastId = `toast-${Date.now()}`;
    const toastHTML = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-${type}">
                <strong class="mr-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
   
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.error('Toast container not found');
        return;
    }

    // Add the toast to the container
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
   
    // Initialize and show the toast
    const toastElement = document.getElementById(toastId);
    const bsToast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: duration
    });
   
    bsToast.show();

    // Remove the toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Declare global variables and function at the top
let s3; // Ensure s3 is defined globally
let auth; // Declare auth globally
let fetchS3Contents;
let currentPrefix = '';
let history = [];
let folderInput; // Declare folderInput globally

// Add loadHistory function at the top with other global functions
async function loadHistory() {
    try {
        const params = {
            Bucket: window.appConfig.AWS_BUCKET_NAME,
            Key: 'history-log.json'
        };

        if (!s3) {
            throw new Error('S3 client is not initialized');
        }

        const data = await s3.getObject(params).promise();

        if (!data.Body) {
            throw new Error('No data returned from S3 for history-log.json');
        }

        const historyData = JSON.parse(data.Body.toString());
        history = historyData;
        updateHistoryUI(historyData);
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            // If history file doesn't exist, initialize empty history
            history = [];
            updateHistoryUI([]);
        } else {
            console.error('Error loading history:', error);
            showToast('Error loading history', 'danger');
        }
    }
}

// Add this function near the top with other helper functions
function formatDateToCustomString(dateString) {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
   
    // Add ordinal suffix to day
    const ordinal = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    return `${day}${ordinal(day)} ${month} ${year}`;
}

// Add updateHistoryUI function near the top with other global functions
function updateHistoryUI(historyData) {
    const historyContents = document.getElementById('history-contents');
    if (!historyContents) {
        console.error('History contents element not found');
        return;
    }
   
    historyContents.innerHTML = historyData.map(item => `
        <tr>
            <td>${formatDateToCustomString(item.date)}</td>
            <td>${item.action}</td>
            <td>${(item.size / (1024 * 1024)).toFixed(2)} MB</td>
            <td>${item.fileCount}</td>
        </tr>
    `).join('');
}

// Single consolidated modal handler function
const setupModalHandlers = () => {
    const modals = document.querySelectorAll('.modal');
   
    modals.forEach(modal => {
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        let previousActiveElement;

        // Modal show handler
        $(modal).on('show.bs.modal', function() {
            previousActiveElement = document.activeElement;
            modal.removeAttribute('aria-hidden');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('role', 'dialog');
           
            setTimeout(() => {
                if (firstFocusable) {
                    firstFocusable.focus();
                }
            }, 50);
        });

        // Modal hide handler
        $(modal).on('hidden.bs.modal', function() {
            modal.removeAttribute('aria-modal');
            modal.removeAttribute('role');
           
            if (previousActiveElement) {
                previousActiveElement.focus();
            }
           
            cleanupModals();
        });

        // Keyboard navigation
        modal.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            } else if (e.key === 'Escape') {
                $(modal).modal('hide');
            }
        });
    });
};

// Rest of your existing code
document.addEventListener('DOMContentLoaded', async function() {
    // Move AWS configuration to the top before any AWS service calls
    const initAWS = async () => {
        try {
            if (!window.appConfig.AWS_REGION || !window.appConfig.AWS_ACCESS_KEY_ID || !window.appConfig.AWS_SECRET_ACCESS_KEY || !window.appConfig.AWS_BUCKET_NAME) {
                throw new Error('AWS configuration is missing in appConfig');
            }

            AWS.config.update({
                region: window.appConfig.AWS_REGION,
                accessKeyId: window.appConfig.AWS_ACCESS_KEY_ID,
                secretAccessKey: window.appConfig.AWS_SECRET_ACCESS_KEY
            });

            s3 = new AWS.S3();

            console.log('AWS initialized successfully');
        } catch (error) {
            console.error('Error initializing AWS:', error);
            showToast('Failed to initialize AWS configuration', 'danger');
            throw error; // Re-throw to handle upstream if necessary
        }
    };

    // Initialize AWS and get S3 instance
    try {
        await initAWS();
    } catch (error) {
        console.error('Error initializing app:', error);
    }

    // Firebase configuration
    const firebaseConfig = window.appConfig.FIREBASE_CONFIG;

    // Initialize folderInput
    folderInput = document.getElementById('folder-upload');
   
    // Initialize Firebase with proper error handling
    try {
        const app = window.initializeApp(firebaseConfig);
        auth = window.getAuth(app); // Assign to global auth variable
       
        // Move the auth state observer inside the try block
        window.onAuthStateChanged(auth, (user) => {
            if (user) {
                showMainUI(user);
                // Set up AWS credentials after successful authentication
                AWS.config.update({
                    region: window.appConfig.AWS_REGION,
                    credentials: new AWS.Credentials({
                        accessKeyId: window.appConfig.AWS_ACCESS_KEY_ID,
                        secretAccessKey: window.appConfig.AWS_SECRET_ACCESS_KEY
                    })
                });
            } else {
                showLoginPage();
            }
        });
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showToast('Error initializing application', 'danger');
        return; // Exit if Firebase fails to initialize
    }

    // Function to show the main UI
    async function showMainUI(user) {
        document.getElementById('login-container').classList.add('d-none');
        document.getElementById('main-ui').classList.remove('d-none');
        document.getElementById('display-name').textContent = user.displayName || user.email || 'User';
   
        // Initialize the main UI components
        fetchS3Contents();
        loadHistory();
       
        // Show the folders section by default
        document.getElementById('folders-section').classList.remove('d-none');
        document.getElementById('history-section').classList.add('d-none');
    }

    // Function to show the login page
    function showLoginPage() {
        document.getElementById('login-container').classList.remove('d-none');
        document.getElementById('main-ui').classList.add('d-none');
    }

    // Login form submission handler
    document.getElementById('login-form').addEventListener('submit', async function(event) {
        event.preventDefault();
        const email = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
       
        try {
            document.getElementById('login-error-message').classList.add('d-none');
            const user = await handleLogin(email, password);
            showMainUI(user);
        } catch (error) {
            console.error('Error during login:', error);
            document.getElementById('login-error-message').classList.remove('d-none');
            document.getElementById('login-error-message').textContent = error.message;
        }
    });

    // Function to handle login with improved error handling
    async function handleLogin(email, password) {
        try {
            const userCredential = await window.signInWithEmailAndPassword(auth, email, password);
            showToast('Successfully logged in!', 'success');
            return userCredential.user;
        } catch (error) {
            let errorMessage = 'An error occurred during login.';
            switch (error.code) {
                case 'auth/wrong-password':
                case 'auth/user-not-found':
                    errorMessage = 'Invalid email or password.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed login attempts. Please try again later.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your connection.';
                    break;
            }
            throw new Error(errorMessage);
        }
    }

    // Logout button handler
    document.getElementById('logout-button').addEventListener('click', function() {
        window.signOut(auth).then(() => {
            showLoginPage();
        }).catch((error) => {
            console.error('Error during logout:', error);
        });
    });

    // Configure AWS using secrets from environment variables
    AWS.config.update({
        region: window.appConfig.AWS_REGION,
        credentials: new AWS.Credentials({
            accessKeyId: window.appConfig.AWS_ACCESS_KEY_ID,
            secretAccessKey: window.appConfig.AWS_SECRET_ACCESS_KEY
        })
    });

    // Function to format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Function to format date
    function formatDate(date) {
        return new Date(date).toLocaleString();
    }

    // Function to update breadcrumb
    function updateBreadcrumb(prefix) {
        const breadcrumb = document.getElementById('folder-breadcrumb');
        if (!breadcrumb) {
            console.error('Breadcrumb element not found');
            return;
        }
   
        const parts = prefix.split('/').filter(Boolean);
        let breadcrumbHTML = '<li class="breadcrumb-item"><a href="#" class="text-white" data-prefix="">Root</a></li>';
        let currentPath = '';
       
        parts.forEach((part, index) => {
            currentPath += part + '/';
            const isLast = index === parts.length - 1;
            breadcrumbHTML += `
                <li class="breadcrumb-item ${isLast ? 'active' : ''}">
                    ${isLast ? `<span class="text-info">${part}</span>` :
                    `<a href="#" class="text-white" data-prefix="${currentPath}">${part}</a>`}
                </li>
            `;
        });
       
        breadcrumb.innerHTML = breadcrumbHTML;
       
        // Add click handlers to breadcrumb links
        breadcrumb.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                fetchS3Contents(e.target.dataset.prefix || '');
            });
        });
    }

    // Helper function to calculate the total size of a folder
    async function getFolderSize(prefix) {
        let totalSize = 0;
        let continuationToken = null;
        do {
            const params = {
                Bucket: window.appConfig.AWS_BUCKET_NAME,
                Prefix: prefix,
                ContinuationToken: continuationToken
            };
            const data = await s3.listObjectsV2(params).promise();
            data.Contents.forEach(obj => {
                totalSize += obj.Size;
            });
            continuationToken = data.IsTruncated ? data.NextContinuationToken : null;
        } while (continuationToken);
        return totalSize;
    }

    // Move fetchS3Contents definition to global scope
    fetchS3Contents = async function(prefix = '') {
        try {
            currentPrefix = prefix;
            updateBreadcrumb(prefix);
           
            const s3Contents = document.getElementById('s3-contents');
            if (!s3Contents) {
                console.error('S3 contents element not found');
                return;
            }
   
            // Show loading state
            s3Contents.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="sr-only">Loading...</span>
                        </div>
                    </td>
                </tr>
            `;
           
            const params = {
                Bucket: window.appConfig.AWS_BUCKET_NAME,
                Prefix: prefix,
                Delimiter: '/'
            };
   
            const data = await s3.listObjectsV2(params).promise();
           
            if (!data.Contents && !data.CommonPrefixes) {
                s3Contents.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center">No contents found</td>
                    </tr>
                `;
                return;
            }

            let contentsHTML = '';

            // Add parent directory link if not at root
            if (prefix) {
                const parentPrefix = prefix.split('/').slice(0, -2).join('/') + '/';
                contentsHTML += `
                    <tr class="folder-row">
                        <td>
                            <a href="#" class="back-link" data-prefix="${parentPrefix}">
                                <i class="fas fa-arrow-left"></i>
                            </a>
                        </td>
                        <td colspan="4">
                            Back to parent directory
                        </td>
                    </tr>
                `;
            }

            // Add folders with size
            if (data.CommonPrefixes) {
                const folderPromises = data.CommonPrefixes.map(async (commonPrefix) => {
                    const folderPrefix = commonPrefix.Prefix;
                    const folderSize = await getFolderSize(folderPrefix);
                    return `
                        <tr class="folder-row">
                            <td><i class="fas fa-folder folder-icon"></i></td>
                            <td><a href="#" class="text-decoration-none" data-prefix="${folderPrefix}">${folderPrefix}</a></td>
                            <td class="file-size">${formatFileSize(folderSize)}</td>
                            <td class="file-actions">
                                <button class="btn btn-sm btn-primary download-folder-button" data-prefix="${folderPrefix}">
                                    <i class="fas fa-download"></i> Download
                                </button>
                            </td>
                        </tr>
                    `;
                });
                const folders = await Promise.all(folderPromises);
                contentsHTML += folders.join('');
            }

            // Add files
            if (data.Contents) {
                data.Contents.filter(item => item.Key !== prefix && item.Key !== 'history-log.json')
                    .forEach(item => {
                        const fileName = item.Key.split('/').pop();
                        contentsHTML += `
                            <tr>
                                <td><i class="fas fa-file file-icon"></i></td>
                                <td>${fileName}</td>
                                <td class="file-size">${formatFileSize(item.Size)}</td>
                                <td class="file-actions">
                                    <button class="btn btn-sm btn-primary download-button" data-key="${item.Key}">
                                        <i class="fas fa-download"></i> Download
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
            }

            s3Contents.innerHTML = contentsHTML;
           
            // Add click handlers for folder navigation
            s3Contents.querySelectorAll('.folder-row a').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    fetchS3Contents(e.target.dataset.prefix);
                });
            });
        } catch (err) {
            console.error('Error fetching S3 contents:', err);
            showToast('Error fetching S3 contents. Please check console for details.', 'danger');
        }
    };

    // Function to update history
    async function updateHistory(action, size, fileCount) {
        const currentDate = new Date().toISOString(); // Store full ISO date string
        history.push({ date: currentDate, action, size, fileCount });
        updateHistoryUI(history);

        // Save history to S3
        const params = {
            Bucket: window.appConfig.AWS_BUCKET_NAME,
            Key: 'history-log.json',
            Body: JSON.stringify(history),
            ContentType: 'application/json'
        };
        await s3.putObject(params).promise();
    }

   

    // Add helper function to update history UI
    function updateHistoryUI(historyData) {
        const historyContents = document.getElementById('history-contents');
        if (historyContents) {
            historyContents.innerHTML = historyData.map(item => `
                <tr>
                    <td>${formatDateToCustomString(item.date)}</td>
                    <td>${item.action}</td>
                    <td>${(item.size / (1024 * 1024)).toFixed(2)} MB</td>
                    <td>${item.fileCount}</td>
                </tr>
            `).join('');
        }
    }

    // Upload button handler
    document.getElementById('upload-button').addEventListener('click', async function() {
        const folderInput = document.getElementById('folder-upload');
        const errorMessage = document.getElementById('error-message');
        const progressBar = document.getElementById('upload-progress');
        const progressBarInner = progressBar.querySelector('.progress-bar');

        if (!folderInput.files.length) {
            if (errorMessage) {
                errorMessage.classList.remove('d-none');
            } else {
                console.error('Element not found');
            }
            return;
        }

        if (errorMessage) {
            errorMessage.classList.add('d-none');
        } else {
            console.error('Element not found');
        }
        if (progressBar) {
            progressBar.classList.remove('d-none');
        } else {
            console.error('Element not found');
        }

        try {
            const existingFiles = await s3.listObjectsV2({ Bucket: window.appConfig.AWS_BUCKET_NAME, Prefix: currentPrefix }).promise();
            const existingKeys = new Set(existingFiles.Contents.map(item => item.Key));
            let newFilesCount = 0;
            let totalSize = 0;

            const uploadProgress = await uploadFiles(folderInput.files, currentPrefix);
            newFilesCount = uploadProgress.current;
            totalSize = uploadProgress.size;

            if (newFilesCount === 0) {
                showToast('No new files to upload.', 'warning');
            } else {
                showToast('Folder uploaded successfully.', 'success');
                await updateHistory('Upload', totalSize, newFilesCount);
                await fetchS3Contents(currentPrefix); // Refresh the list
            }
        } catch (err) {
            console.error('Error uploading files:', err);
            showToast('Error uploading files. Please check console for details.', 'danger');
        } finally {
            if (progressBar) {
                progressBar.classList.add('d-none');
            } else {
                console.error('Element not found');
            }
            if (progressBarInner) {
                progressBarInner.style.width = '0%';
            } else {
                console.error('Element not found');
            }
            if (folderInput) {
                folderInput.value = '';
            } else {
                console.error('Element not found');
            }
        }
    });

    // Function to handle file uploads with improved progress tracking
    async function uploadFiles(files, currentPrefix) {
        const uploadProgress = {
            total: files.length,
            current: 0,
            size: 0,
            totalBytes: 0,
            uploadedBytes: 0
        };

        // Calculate total size first
        for (const file of files) {
            uploadProgress.totalBytes += file.size;
        }

        const progressBar = document.getElementById('upload-progress');
        const progressBarInner = progressBar.querySelector('.progress-bar');
        progressBar.classList.remove('d-none');

        try {
            for (const file of files) {
                const key = currentPrefix + (file.webkitRelativePath || file.name);
                const params = {
                    Bucket: window.appConfig.AWS_BUCKET_NAME,
                    Key: key,
                    Body: file,
                    ContentType: file.type || 'application/octet-stream'
                };

                await s3.upload(params)
                    .on('httpUploadProgress', (progress) => {
                        if (progress.total) {
                            // Update current file progress
                            const currentFileProgress = Math.round((progress.loaded / progress.total) * 100);
                           
                            // Update total progress
                            uploadProgress.uploadedBytes = uploadProgress.size + progress.loaded;
                            const totalProgress = Math.round((uploadProgress.uploadedBytes / uploadProgress.totalBytes) * 100);
                           
                            progressBarInner.style.width = `${totalProgress}%`;
                            progressBarInner.textContent = `Uploading: ${totalProgress}% (File ${uploadProgress.current + 1}/${files.length})`;
                        }
                    })
                    .promise();

                uploadProgress.current++;
                uploadProgress.size += file.size;
            }
           
            return uploadProgress;
        } catch (error) {
            throw error;
        } finally {
            progressBar.classList.add('d-none');
            progressBarInner.style.width = '0%';
            progressBarInner.textContent = '';
        }
    }

    // Navigation and download handlers
    document.getElementById('s3-contents').addEventListener('click', async function(event) {
        if (event.target.classList.contains('navigate-button')) {
            const prefix = event.target.getAttribute('data-prefix');
            await fetchS3Contents(prefix);
        } else if (event.target.classList.contains('download-button')) {
            const key = event.target.getAttribute('data-key');
            const fileName = key.split('/').pop();
            try {
                await downloadFileWithProgress(key, fileName);
            } catch (err) {
                console.error('Error in download handler:', err);
            }
        } else if (event.target.classList.contains('download-folder-button')) {
            const prefix = event.target.getAttribute('data-prefix');
            try {
                await downloadFolderWithProgress(prefix);
            } catch (err) {
                console.error('Error in folder download handler:', err);
            }
        }
    });

    // Function to handle file downloads with progress tracking
    async function downloadFileWithProgress(key, fileName) {
        const progressBar = document.getElementById('download-progress');
        const progressBarInner = progressBar.querySelector('.progress-bar');
        progressBar.classList.remove('d-none');

        try {
            const headParams = {
                Bucket: window.appConfig.AWS_BUCKET_NAME,
                Key: key
            };

            // Get file size first
            const headData = await s3.headObject(headParams).promise();
            const totalSize = headData.ContentLength;

            // Download the file
            const data = await s3.getObject(headParams)
                .on('httpDownloadProgress', (progress) => {
                    const percent = Math.round((progress.loaded / totalSize) * 100);
                    progressBarInner.style.width = `${percent}%`;
                    progressBarInner.textContent = `Downloading: ${percent}%`;
                })
                .promise();

            // Create and trigger download
            const blob = new Blob([data.Body]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            await updateHistory('Download', totalSize, 1);
            showToast('Download completed successfully!', 'success');
        } catch (error) {
            console.error('Error downloading file:', error);
            showToast('Error downloading file', 'danger');
            throw error;
        } finally {
            progressBar.classList.add('d-none');
            progressBarInner.style.width = '0%';
            progressBarInner.textContent = '';
        }
    }

    // Function to handle folder downloads with progress tracking
    async function downloadFolderWithProgress(prefix) {
        const progressBar = document.getElementById('download-progress');
        const progressBarInner = progressBar.querySelector('.progress-bar');
        progressBar.classList.remove('d-none');

        try {
            const params = {
                Bucket: window.appConfig.AWS_BUCKET_NAME,
                Prefix: prefix
            };

            const data = await s3.listObjectsV2(params).promise();
            const zip = new JSZip();
            let totalSize = 0;
            let downloadedSize = 0;

            // Calculate total size first
            for (const item of data.Contents) {
                totalSize += item.Size;
            }

            // Download and add each file to zip
            for (const item of data.Contents) {
                const fileData = await s3.getObject({
                    Bucket: window.appConfig.AWS_BUCKET_NAME,
                    Key: item.Key
                })
                .on('httpDownloadProgress', (progress) => {
                    downloadedSize += progress.loaded;
                    const percent = Math.round((downloadedSize / totalSize) * 100);
                    progressBarInner.style.width = `${percent}%`;
                    progressBarInner.textContent = `Creating Zip: ${percent}%`;
                })
                .promise();

                zip.file(item.Key.replace(prefix, ''), fileData.Body);
            }

            progressBarInner.textContent = 'Generating zip file...';
            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            }, (metadata) => {
                const percent = Math.round(metadata.percent);
                progressBarInner.style.width = `${percent}%`;
                progressBarInner.textContent = `Compressing: ${percent}%`;
            });

            const url = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${prefix.split('/').slice(-2, -1)[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            await updateHistory('Download', totalSize, data.Contents.length);
            showToast('Folder download completed successfully!', 'success');
        } catch (error) {
            console.error('Error downloading folder:', error);
            showToast('Error downloading folder', 'danger');
            throw error;
        } finally {
            progressBar.classList.add('d-none');
            progressBarInner.style.width = '0%';
            progressBarInner.textContent = '';
        }
    }

    // Navigate Up button handler
    const navigateUpButton = document.getElementById('navigate-up-button');
    if (navigateUpButton) {
        navigateUpButton.addEventListener('click', function() {
            const parts = currentPrefix.split('/').filter(Boolean);
            if (parts.length > 0) {
                parts.pop();
                fetchS3Contents(parts.join('/') + '/');
            } else {
                fetchS3Contents('');
            }
        });
    }

    // Folders link handler
    document.getElementById('folders-link').addEventListener('click', function() {
        document.getElementById('folders-section').classList.remove('d-none');
        document.getElementById('history-section').classList.add('d-none');
        fetchS3Contents(currentPrefix);
    });

    // History link handler
    document.getElementById('history-link').addEventListener('click', function() {
        document.getElementById('folders-section').classList.add('d-none');
        document.getElementById('history-section').classList.remove('d-none');
    });

    // Home link handler
    document.getElementById('home-link').addEventListener('click', function() {
        document.getElementById('folders-section').classList.add('d-none');
        document.getElementById('history-section').classList.add('d-none');
        const s3Contents = document.getElementById('s3-contents');
        if (s3Contents) {
            s3Contents.innerHTML = '';
        } else {
            console.error('Element not found');
        }
    });

    // Clear history button handler
    document.getElementById('clear-history-button').addEventListener('click', function() {
        const clearHistoryModal = `
            <div class="modal fade" id="clearHistoryModal" tabindex="-1" role="dialog" aria-labelledby="clearHistoryModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title" id="clearHistoryModalLabel">
                                <i class="fas fa-exclamation-triangle mr-2"></i>Confirm Clear History
                            </h5>
                            <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body py-4">
                            <p class="mb-0 text-center">Are you sure you want to clear the history? This action cannot be undone.</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">
                                <i class="fas fa-times mr-2"></i>Cancel
                            </button>
                            <button type="button" class="btn btn-danger" id="confirm-clear-history">
                                <i class="fas fa-trash-alt mr-2"></i>Clear History
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
       
        // Remove any existing modal
        const existingModal = document.getElementById('clearHistoryModal');
        if (existingModal) {
            existingModal.remove();
        }
       
        document.body.insertAdjacentHTML('beforeend', clearHistoryModal);
        $('#clearHistoryModal').modal('show');

        document.getElementById('confirm-clear-history').addEventListener('click', async function() {
            try {
                history = [];
                const historyContents = document.getElementById('history-contents');
                if (historyContents) {
                    historyContents.innerHTML = '';
                } else {
                    console.error('Element not found');
                }
                showToast('History cleared successfully', 'success');

                // Clear history in S3
                const params = {
                    Bucket: window.appConfig.AWS_BUCKET_NAME,
                    Key: 'history-log.json',
                    Body: JSON.stringify(history),
                    ContentType: 'application/json'
                };
                await s3.putObject(params).promise();

                // Hide the modal
                $('#clearHistoryModal').modal('hide');
                $('#clearHistoryModal').on('hidden.bs.modal', function () {
                    const clearHistoryModalElement = document.getElementById('clearHistoryModal');
                    if (clearHistoryModalElement) {
                        clearHistoryModalElement.remove();
                    } else {
                        console.error('Element not found');
                    }
                });
            } catch (error) {
                console.error('Error clearing history:', error);
                showToast('Error clearing history', 'danger');
            }
        });
    });

    // Initial fetch of S3 contents
    fetchS3Contents();

    // Load history from S3
    loadHistory();

    // Custom file input label update
    $('#folder-upload').on('change', function() {
        var fileName = $(this).val().split('\\').pop();
        $(this).next('.custom-file-label').addClass('selected').html(fileName);
    });

    // Update the Home link handler
    document.getElementById('home-link').addEventListener('click', function() {
        // Hide all sections except upload section
        document.getElementById('folders-section').classList.add('d-none');
        document.getElementById('history-section').classList.add('d-none');
       
        // Show upload section
        document.querySelector('.upload-section').classList.remove('d-none');
       
        // Clear any active modals
        $('.modal').modal('hide');
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();
       
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
       
        // Add active class to home link
        this.parentElement.classList.add('active');
    });

    // Update the Folders link handler
    document.getElementById('folders-link').addEventListener('click', function() {
        // Show folders section and hide others
        document.getElementById('folders-section').classList.remove('d-none');
        document.getElementById('history-section').classList.add('d-none');
        document.querySelector('.upload-section').classList.add('d-none');
       
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        this.parentElement.classList.add('active');
       
        // Refresh folders content
        fetchS3Contents(currentPrefix);
    });

    // Update the History link handler
    document.getElementById('history-link').addEventListener('click', function() {
        // Show history section and hide others
        document.getElementById('folders-section').classList.add('d-none');
        document.getElementById('history-section').classList.remove('d-none');
        document.querySelector('.upload-section').classList.add('d-none');
       
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        this.parentElement.classList.add('active');
    });

    // Add modal cleanup code
    $(document).on('hidden.bs.modal', '.modal', function () {
        // Remove modal-related classes and elements
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();
    });

    // Replace initializeDropZone function
    function initializeDropZone() {
        const dropZone = document.querySelector('.drop-zone');
        const input = document.getElementById('folder-upload');
       
        if (!dropZone || !input) {
            console.error('Drop zone or input elements not found');
            return;
        }
   
        // Handle click to open folder dialog
        dropZone.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            input.click();
        });
   
        // Handle drag enter
        dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drop-zone--over');
        });
   
        // Handle drag over
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drop-zone--over');
        });
   
        // Handle drag leave
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target === dropZone) {
                dropZone.classList.remove('drop-zone--over');
            }
        });
   
        // Handle drop
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drop-zone--over');
   
            const items = Array.from(e.dataTransfer.items);
            for (const item of items) {
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry();
                    if (entry && entry.isDirectory) {
                        await processDirectoryEntry(entry);
                    }
                }
            }
        });
   
        // Handle folder selection
        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                handleSelectedFiles(files);
            }
        });
    }
   
    // Add new helper function for processing directory entries
    async function processDirectoryEntry(dirEntry, path = '') {
        const dirReader = dirEntry.createReader();
        const entries = await readAllDirectoryEntries(dirReader);
       
        for (const entry of entries) {
            if (entry.isFile) {
                const file = await getFileFromEntry(entry);
                file.fullPath = path + entry.name;
                addFileToUploadList(file, file.fullPath);
            } else if (entry.isDirectory) {
                await processDirectoryEntry(entry, path + entry.name + '/');
            }
        }
    }
   
    // Add helper function to read all directory entries
    function readAllDirectoryEntries(dirReader) {
        return new Promise((resolve) => {
            const entries = [];
           
            function readEntries() {
                dirReader.readEntries((results) => {
                    if (results.length) {
                        entries.push(...results);
                        readEntries();
                    } else {
                        resolve(entries);
                    }
                }, (error) => {
                    console.error('Error reading directory:', error);
                    resolve(entries);
                });
            }
           
            readEntries();
        });
    }
   
    // Update handleSelectedFiles function
    function handleSelectedFiles(files) {
        // Clear previous selections
        selectedFiles.clear();
        const uploadList = document.getElementById('selected-files');
        if (!uploadList) return;
       
        uploadList.innerHTML = '';
       
        files.forEach(file => {
            const path = file.webkitRelativePath || file.name;
            addFileToUploadList(file, path);
            selectedFiles.add(file);
        });
   
        // Show upload list and enable upload button
        document.getElementById('upload-list').classList.remove('d-none');
        const uploadButton = document.getElementById('upload-button');
        if (uploadButton) {
            uploadButton.disabled = false;
        }
    }
   
    // Drag and Drop functionality
    const dropZone = document.querySelector('.drop-zone');
    const input = dropZone.querySelector('.drop-zone__input');
    const uploadButton = document.getElementById('upload-button');
    const selectedFilesList = document.getElementById('selected-files');
    const uploadList = document.getElementById('upload-list');
    let selectedFiles = new Set();

    dropZone.addEventListener('click', () => input.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drop-zone--over');
    });

    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, (e) => {
            dropZone.classList.remove('drop-zone--over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone--over');

        const items = Array.from(e.dataTransfer.items);
        handleItems(items);
    });

    input.addEventListener('change', (e) => {
        handleFiles(Array.from(e.target.files));
    });

    async function handleItems(items) {
        for (const item of items) {
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    await processEntry(entry);
                }
            }
        }
        updateUploadButton();
    }

    async function processEntry(entry, path = '') {
        if (entry.isFile) {
            const file = await getFile(entry);
            file.fullPath = path + file.name;
            addFileToList(file);
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const entries = await readEntries(dirReader);
            for (const childEntry of entries) {
                await processEntry(childEntry, path + entry.name + '/');
            }
        }
    }

    function getFile(fileEntry) {
        return new Promise((resolve) => {
            fileEntry.file(resolve);
        });
    }

    function readEntries(dirReader) {
        return new Promise((resolve) => {
            dirReader.readEntries((entries) => {
                resolve(entries);
            });
        });
    }

    function handleFiles(files) {
        files.forEach(file => {
            file.fullPath = file.webkitRelativePath || file.name;
            addFileToList(file);
        });
        updateUploadButton();
    }

    function addFileToList(file) {
        selectedFiles.add(file);
        uploadList.classList.remove('d-none');
        updateFilesList();
    }

    function updateFilesList() {
        selectedFilesList.innerHTML = Array.from(selectedFiles).map(file => `
            <li class="list-group-item">
                <div>
                    <i class="fas ${file.fullPath.endsWith('/') ? 'fa-folder' : 'fa-file'}"></i>
                    ${file.fullPath}
                </div>
                <i class="fas fa-times remove-file" data-path="${file.fullPath}" style="color: #ffffff;"></i>
            </li>
        `).join('');

        // Add remove file handlers
        document.querySelectorAll('.remove-file').forEach(button => {
            button.addEventListener('click', (e) => {
                const path = e.target.dataset.path;
                selectedFiles = new Set(Array.from(selectedFiles).filter(file => file.fullPath !== path));
                updateFilesList();
                updateUploadButton();
            });
        });
    }

    function updateUploadButton() {
        uploadButton.disabled = selectedFiles.size === 0;
    }

    // Update the upload button handler
    uploadButton.addEventListener('click', async function() {
        if (selectedFiles.size === 0) return;

        try {
            const progressBar = document.getElementById('upload-progress');
            progressBar.classList.remove('d-none');
           
            let totalSize = 0;
            let uploadedFiles = 0;
           
            for (const file of selectedFiles) {
                const key = currentPrefix + file.fullPath;
                const params = {
                    Bucket: window.appConfig.AWS_BUCKET_NAME,
                    Key: key,
                    Body: file,
                    ContentType: file.type || 'application/octet-stream'
                };

                await s3.upload(params).on('httpUploadProgress', (progress) => {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    const progressBarInner = progressBar.querySelector('.progress-bar');
                    progressBarInner.style.width = `${percent}%`;
                    progressBarInner.textContent = `${percent}%`;
                }).promise();

                totalSize += file.size;
                uploadedFiles++;
            }

            await updateHistory('Upload', totalSize, uploadedFiles);
            showToast('Upload completed successfully!', 'success');
           
            // Clear selection
            selectedFiles.clear();
            updateFilesList();
            updateUploadButton();
            uploadList.classList.add('d-none');
           
            // Refresh the file list
            await fetchS3Contents(currentPrefix);
        } catch (err) {
            console.error('Error uploading files:', err);
            showToast('Error uploading files. Please check console for details.', 'danger');
        } finally {
            const progressBar = document.getElementById('upload-progress');
            progressBar.classList.add('d-none');
        }
    });

    // Handle file selection via input
    folderInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // Clear any previous error message
            errorMessage.classList.add('d-none');
            // Clear previous selection
            selectedFiles.clear();
            // Add all files from the folder
            files.forEach(file => {
                file.fullPath = file.webkitRelativePath;
                selectedFiles.add(file);
            });
            updateFilesList();
            uploadButton.disabled = false;
        }
    });

    // Handle drop
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone--over');
       
        const items = Array.from(e.dataTransfer.items);
        // Only process if items contain a directory
        const hasFolder = items.some(item => {
            const entry = item.webkitGetAsEntry();
            return entry && entry.isDirectory;
        });
       
        if (hasFolder) {
            errorMessage.classList.add('d-none');
            selectedFiles.clear();
            handleItems(items);
        }
    });

    // Function to handle file uploads with improved progress tracking
    async function uploadFiles(files, currentPrefix) {
        const uploadProgress = {
            total: files.length,
            current: 0,
            size: 0,
            totalBytes: 0,
            uploadedBytes: 0
        };

        // Calculate total size first
        for (const file of files) {
            uploadProgress.totalBytes += file.size;
        }

        const progressBar = document.getElementById('upload-progress');
        const progressBarInner = progressBar.querySelector('.progress-bar');
        progressBar.classList.remove('d-none');

        try {
            for (const file of files) {
                const key = currentPrefix + (file.webkitRelativePath || file.name);
                const params = {
                    Bucket: window.appConfig.AWS_BUCKET_NAME,
                    Key: currentPrefix + key,
                    Body: file,
                    ContentType: file.type || 'application/octet-stream'
                };

                await s3.upload(params).on('httpUploadProgress', (progress) => {
                    if (progress.total) {
                        const percent = Math.round((progress.loaded / progress.total) * 100);
                        progressBarInner.style.width = `${percent}%`;
                        progressBarInner.textContent = `${percent}%`;
                    }
                }).promise();

                uploadProgress.current++;
                uploadProgress.size += file.size;
            }
           
            return uploadProgress;
        } catch (error) {
            throw error;
        } finally {
            progressBar.classList.add('d-none');
            progressBarInner.style.width = '0%';
            progressBarInner.textContent = '';
        }
    }

    // Replace the drag and drop initialization code with this updated version
    function initializeDropZone() {
        const dropZone = document.querySelector('.drop-zone');
        const input = dropZone.querySelector('input');
       
        if (!dropZone || !input) return;
   
        // Click to select folder
        dropZone.addEventListener('click', (e) => {
            input.click();
        });
   
        // Drag and drop handlers
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drop-zone--over');
        });
   
        dropZone.addEventListener('dragleave', (e) => {
            dropZone.classList.remove('drop-zone--over');
        });
   
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drop-zone--over');
           
            // Handle items
            const items = Array.from(e.dataTransfer.items);
            for (const item of items) {
                if (item.webkitGetAsEntry) {
                    const entry = item.webkitGetAsEntry();
                    if (entry.isDirectory) {
                        processDirectory(entry);
                    }
                }
            }
        });
   
        // File input change handler
        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                handleSelectedFiles(files);
            }
        });
    }
   
    // Add these new helper functions
    function processDirectory(directoryEntry, path = '') {
        const dirReader = directoryEntry.createReader();
        dirReader.readEntries(async (entries) => {
            for (const entry of entries) {
                if (entry.isFile) {
                    const file = await getFileFromEntry(entry);
                    addFileToUploadList(file, path + entry.name);
                } else if (entry.isDirectory) {
                    processDirectory(entry, path + entry.name + '/');
                }
            }
        });
    }
   
    function getFileFromEntry(fileEntry) {
        return new Promise((resolve) => {
            fileEntry.file(resolve);
        });
    }
   
    function addFileToUploadList(file, path) {
        const uploadList = document.getElementById('selected-files');
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        listItem.innerHTML = `
            <span>
                <i class="fas fa-file"></i>
                ${path || file.name}
            </span>
            <button type="button" class="btn btn-sm btn-danger remove-file">
                <i class="fas fa-times"></i>
            </button>
        `;
       
        uploadList.appendChild(listItem);
        document.getElementById('upload-list').classList.remove('d-none');
        document.getElementById('upload-button').disabled = false;
    }
   
    function handleSelectedFiles(files) {
        // Clear previous selections
        const uploadList = document.getElementById('selected-files');
        uploadList.innerHTML = '';
       
        files.forEach(file => {
            // Use webkitRelativePath for folder structure
            const path = file.webkitRelativePath || file.name;
            addFileToUploadList(file, path);
        });
    }
   
    // Add this to your DOMContentLoaded event listener
    document.addEventListener('DOMContentLoaded', () => {
        // ...existing code...
        initializeDropZone();
        // ...existing code...
    });
});

// Update the initial state
window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('folders-section').classList.add('d-none');
    document.getElementById('history-section').classList.add('d-none');
});

// Update the tab click handlers with null checks
function updateActiveTab(clickedTab) {
    // Hide all sections with null checks
    const sections = ['folders-section', 'history-section'];
    sections.forEach(section => {
        const sectionElement = document.getElementById(section);
        if (sectionElement) {
            sectionElement.classList.add('d-none');
        }
    });
   
    // Hide upload section except for home
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) {
        if (clickedTab !== 'home-link') {
            uploadSection.classList.add('d-none');
        } else {
            uploadSection.classList.remove('d-none');
        }
    }

    // Remove active class from all nav items with null check
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems) {
        navItems.forEach(item => {
            if (item) {
                item.classList.remove('active');
            }
        });
    }

    // Add active class to clicked tab with null check
    const clickedElement = document.querySelector(`#${clickedTab}`);
    if (clickedElement && clickedElement.parentElement) {
        clickedElement.parentElement.classList.add('active');
    }

    // Close any open modals
    $('.modal').modal('hide');
    cleanupModals();
}

// Ensure DOM is fully loaded before adding event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners with null checks
    const navigationLinks = {
        'home-link': function() {
            updateActiveTab('home-link');
        },
        'folders-link': function() {
            updateActiveTab('folders-link');
            const foldersSection = document.getElementById('folders-section');
            if (foldersSection) {
                foldersSection.classList.remove('d-none');
                fetchS3Contents(currentPrefix);
            }
        },
        'history-link': function() {
            updateActiveTab('history-link');
            const historySection = document.getElementById('history-section');
            if (historySection) {
                historySection.classList.remove('d-none');
            }
        }
    };

    // Add click handlers with proper scoping
    Object.entries(navigationLinks).forEach(([id, handler]) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', function(e) {
                e.preventDefault();
                handler();
            });
        }
    });

    // Initialize sections state
    const sectionsToHide = ['folders-section', 'history-section'];
    sectionsToHide.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('d-none');
        }
    });
});

// Function to clean up modals
function cleanupModals() {
    try {
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal) {
                // Remove aria-hidden when modal is closed
                modal.removeAttribute('aria-hidden');
                // Remove inline display style
                modal.style.removeProperty('display');
            }
        });
    } catch (error) {
        console.error('Error cleaning up modals:', error);
    }
}

// Update the modal show functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Remove aria-hidden before showing modal
        modal.removeAttribute('aria-hidden');
        $(modal).modal({
            backdrop: 'static',
            keyboard: true,
            focus: true
        });
    }
}

// Update the navigation handlers with error handling
const setupNavigationHandlers = () => {
    const handlers = {
        'home-link': () => {
            const homeLink = document.getElementById('home-link');
            if (homeLink) {
                homeLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    updateActiveTab('home-link');
                });
            }
        },
        'folders-link': () => {
            const foldersLink = document.getElementById('folders-link');
            if (foldersLink) {
                foldersLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    updateActiveTab('folders-link');
                    const foldersSection = document.getElementById('folders-section');
                    if (foldersSection) {
                        foldersSection.classList.remove('d-none');
                        if (typeof fetchS3Contents === 'function') {
                            fetchS3Contents(currentPrefix);
                        }
                    }
                });
            }
        },
        // ...other handlers
    };

    Object.values(handlers).forEach(handler => {
        try {
            handler();
        } catch (error) {
            console.error('Error setting up handler:', error);
        }
    });
};

// Call the setup function after DOM is loaded
setupNavigationHandlers();

// Initialize the application
const initializeApp = async () => {
    try {
        // Initialize AWS first
        await initAWS();
       
        // Initialize drop zone and set up event listeners
        document.addEventListener('DOMContentLoaded', () => {
            initializeDropZone();
            setupEventListeners();
        });
       
        // Set up modal handlers
        setupModalHandlers();
       
        // Then fetch contents and load history
        await fetchS3Contents('');
        await loadHistory();
       
    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Error initializing application', 'danger');
    }
};

// AWS initialization function
const initAWS = async () => {
    try {
        AWS.config.update({
            region: window.appConfig.AWS_REGION,
            credentials: new AWS.Credentials({
                accessKeyId: window.appConfig.AWS_ACCESS_KEY_ID,
                secretAccessKey: window.appConfig.AWS_SECRET_ACCESS_KEY
            })
        });

        s3 = new AWS.S3({
            apiVersion: '2006-03-01',
            params: { Bucket: window.appConfig.AWS_BUCKET_NAME },
            signatureVersion: 'v4'
        });
    } catch (error) {
        console.error('Error initializing AWS:', error);
        throw error;
    }
};

// Setup event listeners
const setupEventListeners = () => {
    const elements = {
        uploadButton: document.getElementById('upload-button'),
        folderInput: document.getElementById('folder-upload'),
        homeLink: document.getElementById('home-link'),
        foldersLink: document.getElementById('folders-link'),
        historyLink: document.getElementById('history-link'),
        clearHistoryButton: document.getElementById('clear-history-button')
    };

    // Check if elements exist before adding listeners
    if (elements.uploadButton) {
        elements.uploadButton.addEventListener('click', handleUpload);
    }

    if (elements.folderInput) {
        elements.folderInput.addEventListener('change', handleFileSelection);
    }

    if (elements.homeLink) {
        elements.homeLink.addEventListener('click', handleHomeNavigation);
    }

    // ... other event listeners
};

// Add attachEventListeners function
function attachEventListeners() {
    const elements = {
        uploadButton: document.getElementById('upload-button'),
        folderInput: document.getElementById('folder-upload'),
        homeLink: document.getElementById('home-link'),
        foldersLink: document.getElementById('folders-link'),
        historyLink: document.getElementById('history-link'),
        clearHistoryButton: document.getElementById('clear-history-button'),
        dropZone: document.querySelector('.drop-zone')
    };

    // Add event listeners only if elements exist
    if (elements.uploadButton) {
        elements.uploadButton.addEventListener('click', handleUpload);
    }

    if (elements.folderInput) {
        elements.folderInput.addEventListener('change', handleFileSelection);
    }

    if (elements.homeLink) {
        elements.homeLink.addEventListener('click', handleHomeNavigation);
    }

    if (elements.dropZone) {
        initializeDropZone();
    }
}

// Add handleUpload function definition
async function handleUpload() {
    const folderInput = document.getElementById('folder-upload');
    if (!folderInput || !folderInput.files.length) {
        showToast('Please select a folder to upload', 'warning');
        return;
    }

    try {
        const progressBar = document.getElementById('upload-progress');
        if (progressBar) {
            progressBar.classList.remove('d-none');
        }

        const uploadProgress = await uploadFiles(folderInput.files, currentPrefix);
       
        if (uploadProgress.current > 0) {
            showToast(`Successfully uploaded ${uploadProgress.current} files!`, 'success');
            await updateHistory('Upload', uploadProgress.size, uploadProgress.current);
            await fetchS3Contents(currentPrefix);
        } else {
            showToast('No files were uploaded', 'warning');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Error uploading files', 'danger');
    } finally {
        const progressBar = document.getElementById('upload-progress');
        if (progressBar) {
            progressBar.classList.add('d-none');
        }
        if (folderInput) {
            folderInput.value = '';
        }
    }
}

// Add handleFileSelection function definition
function handleFileSelection(event) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.classList.add('d-none');
        }
        handleFiles(files);
    }
}

// Add handleHomeNavigation function definition
function handleHomeNavigation(event) {
    event.preventDefault();
    updateActiveTab('home-link');
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) {
        uploadSection.classList.remove('d-none');
    }
}

// Wait for DOM to load before initializing
document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch(error => {
        console.error('Failed to initialize application:', error);
        showToast('Failed to initialize application', 'danger');
    });
});

// ... rest of your existing code ...

document.addEventListener('DOMContentLoaded', function() {
    // First check if elements exist before adding handlers
    const dropZone = document.querySelector('.drop-zone');
    const folderInput = document.getElementById('folder-upload');

    if (dropZone && folderInput) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        // Handle dropped files
        dropZone.addEventListener('drop', handleDrop, false);
       
        // Handle click to upload
        dropZone.addEventListener('click', () => folderInput.click());
       
        // Handle file input change
        folderInput.addEventListener('change', handleChange);
    }

    // ...rest of your existing DOMContentLoaded code...
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    const dropZone = document.querySelector('.drop-zone');
    if (dropZone) {
        dropZone.classList.add('drop-zone--over');
    }
}

function unhighlight(e) {
    const dropZone = document.querySelector('.drop-zone');
    if (dropZone) {
        dropZone.classList.remove('drop-zone--over');
    }
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const items = dt.items;
   
    if (items) {
        [...items].forEach(item => {
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    processEntry(entry);
                }
            }
        });
    }
}

function handleChange(e) {
    const files = Array.from(e.target.files);
    if (files.length) {
        handleFiles(files);
    }
}

function processEntry(entry, path = '') {
    if (entry.isFile) {
        entry.file(file => {
            addFileToUploadList(file, path + file.name);
        });
    } else if (entry.isDirectory) {
        const reader = entry.createReader();
        reader.readEntries(entries => {
            entries.forEach(entry => {
                processEntry(entry, path + entry.name + '/');
            });
        });
    }
}

function handleFiles(files) {
    const uploadList = document.getElementById('upload-list');
    const uploadButton = document.getElementById('upload-button');
    const selectedFiles = document.getElementById('selected-files');
   
    if (!uploadList || !uploadButton || !selectedFiles) return;
   
    uploadList.classList.remove('d-none');
    uploadButton.disabled = false;
   
    files.forEach(file => {
        const path = file.webkitRelativePath || file.name;
        addFileToUploadList(file, path);
    });
}

function addFileToUploadList(file, path) {
    const selectedFiles = document.getElementById('selected-files');
    if (!selectedFiles) return;
   
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
    listItem.innerHTML = `
        <span>
            <i class="fas ${file.name.endsWith('/') ? 'fa-folder' : 'fa-file'}"></i>
            ${path}
        </span>
        <button type="button" class="btn btn-sm btn-danger remove-file">
            <i class="fas fa-times"></i>
        </button>
    `;
   
    // Add remove button handler
    const removeButton = listItem.querySelector('.remove-file');
    removeButton.addEventListener('click', () => {
        listItem.remove();
        // If no files left, hide upload list and disable upload button
        if (!selectedFiles.children.length) {
            document.getElementById('upload-list').classList.add('d-none');
            document.getElementById('upload-button').disabled = true;
        }
    });
   
    selectedFiles.appendChild(listItem);
}

// Import the sendPasswordResetEmail function at the top with other Firebase imports
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail }
from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

// Add to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', async function() {
    // ...existing initialization code...

    // Forgot Password link handler
    document.getElementById('forgot-password-link').addEventListener('click', function(e) {
        e.preventDefault();
        $('#forgotPasswordModal').modal('show');
    });

    // Forgot Password form submission
    document.getElementById('forgot-password-form').addEventListener('submit', async function(e) {
        e.preventDefault();
       
        const email = document.getElementById('reset-email').value;
        const errorElement = document.getElementById('forgot-password-error');
        const successElement = document.getElementById('forgot-password-success');
       
        try {
            // Reset messages
            errorElement.classList.add('d-none');
            successElement.classList.add('d-none');
           
            // Send password reset email
            await sendPasswordResetEmail(auth, email);
           
            // Show success message
            successElement.textContent = 'Password reset link has been sent to your email.';
            successElement.classList.remove('d-none');
           
            // Clear the form
            document.getElementById('reset-email').value = '';
           
            // Close modal after 3 seconds
            setTimeout(() => {
                $('#forgotPasswordModal').modal('hide');
            }, 3000);
        } catch (error) {
            // Handle specific error cases
            let errorMessage = 'An error occurred while sending the reset link.';
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Please enter a valid email address.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email address.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many attempts. Please try again later.';
                    break;
            }
           
            // Show error message
            errorElement.textContent = errorMessage;
            errorElement.classList.remove('d-none');
        }
    });

    // Reset form and messages when modal is closed
    $('#forgotPasswordModal').on('hidden.bs.modal', function () {
        document.getElementById('forgot-password-form').reset();
        document.getElementById('forgot-password-error').classList.add('d-none');
        document.getElementById('forgot-password-success').classList.add('d-none');
    });

    // ...rest of your existing code...
});

document.addEventListener('DOMContentLoaded', function() {
    // Move variable declarations to the top of the DOMContentLoaded handler
    const dropZone = document.querySelector('.drop-zone');
    const folderInput = document.getElementById('folder-upload');
    const uploadButton = document.getElementById('upload-button');
    const selectedFilesList = document.getElementById('selected-files');
    const uploadList = document.getElementById('upload-list');
    let selectedFiles = new Set();

    // Initialize drop zone handlers if elements exist
    if (dropZone && folderInput) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Set up drop zone event listeners
        dropZone.addEventListener('click', () => folderInput.click());
       
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drop-zone--over');
        });

        ['dragleave', 'dragend'].forEach(type => {
            dropZone.addEventListener(type, (e) => {
                dropZone.classList.remove('drop-zone--over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drop-zone--over');
            const items = Array.from(e.dataTransfer.items);
            handleItems(items);
        });

        // Set up input change handler
        folderInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                // Clear any previous error message
                const errorMessage = document.getElementById('error-message');
                if (errorMessage) {
                    errorMessage.classList.add('d-none');
                }
                // Clear previous selection
                selectedFiles.clear();
                // Add all files from the folder
                files.forEach(file => {
                    file.fullPath = file.webkitRelativePath;
                    selectedFiles.add(file);
                });
                updateFilesList();
                if (uploadButton) {
                    uploadButton.disabled = false;
                }
            }
        });
    }

    // Initialize upload button handler
    if (uploadButton) {
        uploadButton.addEventListener('click', handleUpload);
    }

    // Update the handleFiles function to use the scoped variables
    function handleFiles(files) {
        if (!uploadList || !uploadButton || !selectedFilesList) return;
       
        uploadList.classList.remove('d-none');
        uploadButton.disabled = false;
       
        files.forEach(file => {
            const path = file.webkitRelativePath || file.name;
            addFileToUploadList(file, path);
        });
    }

    // Update file list management functions to use the scoped variables
    function updateFilesList() {
        if (!selectedFilesList) return;
       
        selectedFilesList.innerHTML = Array.from(selectedFiles).map(file => `
            <li class="list-group-item">
                <div>
                    <i class="fas ${file.fullPath.endsWith('/') ? 'fa-folder' : 'fa-file'}"></i>
                    ${file.fullPath}
                </div>
                <i class="fas fa-times remove-file" data-path="${file.fullPath}" style="color: #ffffff;"></i>
            </li>
        `).join('');

        // Add remove file handlers
        document.querySelectorAll('.remove-file').forEach(button => {
            button.addEventListener('click', (e) => {
                const path = e.target.dataset.path;
                selectedFiles = new Set(Array.from(selectedFiles).filter(file => file.fullPath !== path));
                updateFilesList();
                if (uploadButton) {
                    uploadButton.disabled = selectedFiles.size === 0;
                }
            });
        });
    }

    // Initialize other event listeners and functionality
    initializeApp().catch(error => {
        console.error('Failed to initialize application:', error);
        showToast('Failed to initialize application', 'danger');
    });
});

// ...rest of your existing code...

// Add to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', async function() {
    // ...existing code...

    // Cost link handler
    document.getElementById('cost-link').addEventListener('click', async function(e) {
        e.preventDefault();
        updateCostModal();
        $('#costModal').modal('show');
    });

    // Function to calculate AWS costs
    function getOrdinalSuffix(day) {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }
   
    function formatDate() {
        const date = new Date();
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear();
        return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
    }
    async function updateCostModal() {
        try {
            // Get total storage used
            const data = await s3.listObjectsV2({
                Bucket: window.appConfig.AWS_BUCKET_NAME
            }).promise();

            let totalSize = 0;
            data.Contents.forEach(item => {
                totalSize += item.Size;
            });

            // Calculate costs (using AWS S3 Standard pricing)
            const storageGB = totalSize / (1024 * 1024 * 1024);
            const storageCost = storageGB * 0.023; // $0.023 per GB per month
           
            // Calculate transfer cost (example: assuming 10% of storage is transferred)
            const transferGB = storageGB * 0.1;
            const transferCost = transferGB * 0.09; // $0.09 per GB for data transfer

            // Total cost
            const totalCost = storageCost + transferCost;

            // Update modal with costs
            document.getElementById('current-cost').textContent = totalCost.toFixed(2);
            document.getElementById('storage-cost').textContent = storageCost.toFixed(2);
            document.getElementById('transfer-cost').textContent = transferCost.toFixed(2);
            document.getElementById('cost-date').textContent = `As of ${formatDate().toLocaleString()}`;

        } catch (error) {
            console.error('Error calculating costs:', error);
            showToast('Error calculating AWS costs', 'danger');
        }
    }

    // ...existing code...
});

// ...existing code...

// Add this to your imports at the top
import { updateProfile } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

// ...existing code...

// Add event listeners for dropdown items
document.addEventListener('DOMContentLoaded', async function() {
    // ...existing code...

    // Update Profile link handler
    document.getElementById('update-profile-link').addEventListener('click', function(e) {
        e.preventDefault();
        openUpdateProfileModal();
    });

    // Change Password link handler
    document.getElementById('change-password-link').addEventListener('click', function(e) {
        e.preventDefault();
        openChangePasswordModal();
    });

    // Update Profile form submission handler
    document.getElementById('update-profile-form').addEventListener('submit', async function(event) {
        event.preventDefault();
        const displayName = document.getElementById('display-name-input').value;
        const email = document.getElementById('email-input').value;

        try {
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, {
                    displayName: displayName
                });

                // If you need to update the email as well
                if (auth.currentUser.email !== email) {
                    await auth.currentUser.updateEmail(email);
                }

                showToast('Profile updated successfully', 'success');
                $('#updateProfileModal').modal('hide');
                // Update the display name in the UI
                document.getElementById('display-name').textContent = displayName;
            } else {
                throw new Error('No user is currently signed in.');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            showToast('Profile update failed: ' + error.message, 'danger');
        }
    });

    // Change Password form submission handler
    document.getElementById('change-password-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const newPassword = document.getElementById('new-password-input').value;
        const confirmPassword = document.getElementById('confirm-password-input').value;

        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match', 'warning');
            return;
        }

        try {
            if (auth.currentUser) {
                await auth.currentUser.updatePassword(newPassword);
                showToast('Password changed successfully', 'success');
                $('#changePasswordModal').modal('hide');
            }
        } catch (error) {
            console.error('Password change error:', error);
            showToast('Error changing password', 'danger');
        }
    });
});

// Add these helper functions
function openUpdateProfileModal() {
    if (auth?.currentUser) { // Use optional chaining
        document.getElementById('display-name-input').value = auth.currentUser.displayName || '';
        document.getElementById('email-input').value = auth.currentUser.email || '';
        $('#updateProfileModal').modal('show');
    } else {
        console.error('No authenticated user found');
        showToast('Please log in first', 'warning');
    }
}

function openChangePasswordModal() {
    $('#changePasswordModal').modal('show');
}

// Update showMainUI to handle display name
async function showMainUI(user) {
    document.getElementById('login-container').classList.add('d-none');
    document.getElementById('main-ui').classList.remove('d-none');
    document.getElementById('display-name').textContent = user.displayName || user.email || 'User';

    // Initialize the main UI components
    fetchS3Contents();
    loadHistory();

    // Show the folders section by default
    document.getElementById('folders-section').classList.remove('d-none');
    document.getElementById('history-section').classList.add('d-none');
}
