// Declare global variables at the top
let fetchS3Contents;
let currentPrefix = '';
let history = [];

document.addEventListener('DOMContentLoaded', async function() {
    // Firebase configuration
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    };

    let auth; // Declare auth variable in the outer scope
    
    // Initialize Firebase with proper error handling
    try {
        const app = window.initializeApp(firebaseConfig);
        auth = window.getAuth(app); // Assign to outer scope variable
        
        // Move the auth state observer inside the try block
        window.onAuthStateChanged(auth, (user) => {
            if (user) {
                showMainUI(user);
                // Set up AWS credentials after successful authentication
                AWS.config.update({
                    region: process.env.AWS_REGION,
                    credentials: new AWS.Credentials({
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
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
    function showMainUI(user) {
        document.getElementById('login-container').classList.add('d-none');
        document.getElementById('main-ui').classList.remove('d-none');
        document.getElementById('username').textContent = user.email || 'User';
        
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
        region: process.env.AWS_REGION,
        credentials: new AWS.Credentials({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        })
    });

    // Move s3 initialization to global scope
    const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        params: { Bucket: process.env.AWS_BUCKET_NAME },
        signatureVersion: 'v4'
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
                Bucket: process.env.AWS_BUCKET_NAME,
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

            // Add folders
            if (data.CommonPrefixes) {
                data.CommonPrefixes.forEach(item => {
                    const folderName = item.Prefix.split('/').slice(-2, -1)[0];
                    contentsHTML += `
                        <tr class="folder-row">
                            <td><i class="fas fa-folder folder-icon"></i></td>
                            <td><a href="#" class="text-decoration-none" data-prefix="${item.Prefix}">${folderName}</a></td>
                            <td class="file-size">-</td>
                            <td class="last-modified">-</td>
                            <td class="file-actions">
                                <button class="btn btn-sm btn-primary download-folder-button" data-prefix="${item.Prefix}">
                                    <i class="fas fa-download"></i> Download
                                </button>
                            </td>
                        </tr>
                    `;
                });
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
                                <td class="last-modified">${formatDate(item.LastModified)}</td>
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
        const date = new Date().toLocaleString();
        history.push({ date, action, size, fileCount });
        const historyContents = document.getElementById('history-contents');
        if (historyContents) {
            historyContents.innerHTML = history.map(item => `
                <tr>
                    <td>${item.date}</td>
                    <td>${item.action}</td>
                    <td>${(item.size / (1024 * 1024)).toFixed(2)} MB</td>
                    <td>${item.fileCount}</td>
                </tr>
            `).join('');
        } else {
            console.error('Element not found');
        }

        // Save history to S3
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: 'history-log.json',
            Body: JSON.stringify(history),
            ContentType: 'application/json'
        };
        await s3.putObject(params).promise();
    }

    // Function to load history from S3
    async function loadHistory() {
        try {
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: 'history-log.json'
            };
            const data = await s3.getObject(params).promise();
            history = JSON.parse(data.Body.toString());
            const historyContents = document.getElementById('history-contents');
            if (historyContents) {
                historyContents.innerHTML = history.map(item => `
                    <tr>
                        <td>${item.date}</td>
                        <td>${item.action}</td>
                        <td>${(item.size / (1024 * 1024)).toFixed(2)} MB</td>
                        <td>${item.fileCount}</td>
                    </tr>
                `).join('');
            } else {
                console.error('Element not found');
            }
        } catch (err) {
            console.error('Error loading history:', err);
        }
    }

    // Function to fetch AWS cost with INR conversion
    async function fetchAWSCost() {
        const costDetails = document.getElementById('cost-details');
        if (!costDetails) {
            console.error('Cost details element not found');
            return;
        }

        try {
            costDetails.innerHTML = `
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
            `;

            const costExplorer = new AWS.CostExplorer({ region: 'us-east-1' });
            const params = {
                TimePeriod: {
                    Start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
                    End: new Date().toISOString().split('T')[0]
                },
                Granularity: 'MONTHLY',
                Metrics: ['UnblendedCost']
            };

            const data = await costExplorer.getCostAndUsage(params).promise();
            const costUSD = parseFloat(data.ResultsByTime[0].Total.UnblendedCost.Amount);
            
            // Convert USD to INR (using a fixed rate for example, you might want to use a real-time conversion API)
            const exchangeRate = 83; // Current approximate USD to INR rate
            const costINR = costUSD * exchangeRate;
            
            costDetails.innerHTML = `
                <div class="cost-info">
                    <div class="current-cost mb-3">
                        <h6>Current Month Cost</h6>
                        <h2 class="text-success">₹${costINR.toFixed(2)}</h2>
                        <small class="text-muted">($${costUSD.toFixed(2)})</small>
                    </div>
                    <div class="cost-date text-muted">
                        <small>Period: ${params.TimePeriod.Start} to ${params.TimePeriod.End}</small>
                    </div>
                </div>
            `;
        } catch (err) {
            console.error('Error fetching AWS cost:', err);
            costDetails.innerHTML = `
                <div class="alert alert-danger">
                    Error fetching cost data. Please check your AWS credentials and permissions.
                </div>
            `;
            showToast('Error fetching AWS cost. Please check console for details.', 'danger');
        }
    }

    // S3 Info click handler
    document.getElementById('s3-info-link').addEventListener('click', async function() {
        try {
            const params = { Bucket: process.env.AWS_BUCKET_NAME };
            const objects = await s3.listObjectsV2(params).promise();
            
            // Calculate total size and counts
            const totalSize = objects.Contents?.reduce((acc, obj) => acc + obj.Size, 0) || 0;
            const totalFiles = objects.Contents?.length || 0;
            
            // Calculate size breakdowns
            const sizeInGB = totalSize / (1024 * 1024 * 1024);
            const sizeInMB = totalSize / (1024 * 1024);
            const sizeInKB = totalSize / 1024;

            // Get size format based on total size
            let sizeDisplay;
            if (sizeInGB >= 1) {
                sizeDisplay = `${sizeInGB.toFixed(2)} GB`;
            } else if (sizeInMB >= 1) {
                sizeDisplay = `${sizeInMB.toFixed(2)} MB`;
            } else {
                sizeDisplay = `${sizeInKB.toFixed(2)} KB`;
            }

            const bucketDetails = `
                <div class="bucket-info mb-4">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Bucket Statistics</h5>
                            <div class="stats-grid">
                                <div class="stat-item">
                                    <h6>Total Files</h6>
                                    <p class="h3 text-primary">${totalFiles}</p>
                                </div>
                                <div class="stat-item">
                                    <h6>Total Size</h6>
                                    <p class="h3 text-success">${sizeDisplay}</p>
                                </div>
                                <div class="stat-item">
                                    <h6>Average File Size</h6>
                                    <p class="h3 text-info">${(sizeInMB / (totalFiles || 1)).toFixed(2)} MB</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const s3InfoContent = document.getElementById('s3-info-content');
            if (s3InfoContent) {
                console.log('s3-info-content element found:', s3InfoContent);
                s3InfoContent.innerHTML = bucketDetails;
            } else {
                console.error('Element with ID "s3-info-content" not found');
            }
            $('#s3InfoModal').modal('show');
        } catch (error) {
            console.error('Error fetching S3 info:', error);
            if (error.code === 'InvalidAccessKeyId') {
                showToast('Invalid AWS Access Key Id. Please check your credentials.', 'danger');
            } else {
                showToast('Failed to fetch S3 information. Please check console for details.', 'danger');
            }
        }
    });

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
            const existingFiles = await s3.listObjectsV2({ Bucket: process.env.AWS_BUCKET_NAME, Prefix: currentPrefix }).promise();
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
            size: 0
        };

        const progressBar = document.getElementById('upload-progress');
        const progressBarInner = progressBar.querySelector('.progress-bar');

        for (const file of files) {
            try {
                const key = currentPrefix + (file.webkitRelativePath || file.name);
                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: key,
                    Body: file,
                    ContentType: file.type
                };

                await s3.upload(params).on('httpUploadProgress', (progress) => {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    progressBarInner.style.width = `${percent}%`;
                    progressBarInner.textContent = `${percent}%`;
                }).promise();

                uploadProgress.current++;
                uploadProgress.size += file.size;
                
                // Update progress every 5 files
                if (uploadProgress.current % 5 === 0) {
                    showToast(`Uploaded ${uploadProgress.current} of ${uploadProgress.total} files`, 'info');
                }
            } catch (error) {
                console.error(`Error uploading file ${file.name}:`, error);
                showToast(`Failed to upload ${file.name}`, 'danger');
            }
        }

        return uploadProgress;
    }

    // Navigation and download handlers
    document.getElementById('s3-contents').addEventListener('click', async function(event) {
        if (event.target.classList.contains('navigate-button')) {
            const prefix = event.target.getAttribute('data-prefix');
            await fetchS3Contents(prefix);
        } else if (event.target.classList.contains('download-button')) {
            const key = event.target.getAttribute('data-key');
            try {
                const data = await s3.getObject({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: key
                }).promise();

                const blob = new Blob([data.Body]);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = key.split('/').pop();
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                await updateHistory('Download', data.ContentLength, 1);
            } catch (err) {
                console.error('Error downloading file:', err);
                showToast('Error downloading file. Please check console for details.', 'danger');
            }
        } else if (event.target.classList.contains('download-folder-button')) {
            const prefix = event.target.getAttribute('data-prefix');
            try {
                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Prefix: prefix
                };
                const data = await s3.listObjectsV2(params).promise();
                const zip = new JSZip();
                let totalSize = 0;

                for (const item of data.Contents) {
                    const fileData = await s3.getObject({
                        Bucket: process.env.AWS_BUCKET_NAME,
                        Key: item.Key
                    }).promise();
                    zip.file(item.Key.replace(prefix, ''), fileData.Body);
                    totalSize += fileData.ContentLength;
                }

                const content = await zip.generateAsync({ type: 'blob' });
                const url = window.URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${prefix.split('/').slice(-2, -1)[0]}.zip`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                await updateHistory('Download', totalSize, data.Contents.length);
            } catch (err) {
                console.error('Error downloading folder:', err);
                showToast('Error downloading folder. Please check console for details.', 'danger');
            }
        }
    });

    // Navigate Up button handler
    document.getElementById('navigate-up-button').addEventListener('click', function() {
        const parts = currentPrefix.split('/').filter(Boolean);
        if (parts.length > 0) {
            parts.pop();
            fetchS3Contents(parts.join('/') + '/');
        } else {
            fetchS3Contents('');
        }
    });

    // Folders link handler
    document.getElementById('folders-link').addEventListener('click', function() {
        document.getElementById('folders-section').classList.remove('d-none');
        document.getElementById('history-section').classList.add('d-none');
        document.getElementById('cost-section').classList.add('d-none');
        fetchS3Contents(currentPrefix);
    });

    // History link handler
    document.getElementById('history-link').addEventListener('click', function() {
        document.getElementById('folders-section').classList.add('d-none');
        document.getElementById('history-section').classList.remove('d-none');
        document.getElementById('cost-section').classList.add('d-none');
    });

    // Cost link handler
    document.getElementById('cost-link').addEventListener('click', function() {
        document.getElementById('folders-section').classList.add('d-none');
        document.getElementById('history-section').classList.add('d-none');
        document.getElementById('cost-section').classList.remove('d-none');
        $('#costModal').modal('show');
        fetchAWSCost();
    });

    // Home link handler
    document.getElementById('home-link').addEventListener('click', function() {
        document.getElementById('folders-section').classList.add('d-none');
        document.getElementById('history-section').classList.add('d-none');
        document.getElementById('cost-section').classList.add('d-none');
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
                <div class="modal-dialog" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="clearHistoryModalLabel">Clear History</h5>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            Are you sure you want to clear the history?
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirm-clear-history">Clear History</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', clearHistoryModal);
        $('#clearHistoryModal').modal('show');

        document.getElementById('confirm-clear-history').addEventListener('click', async function() {
            history = [];
            const historyContents = document.getElementById('history-contents');
            if (historyContents) {
                historyContents.innerHTML = '';
            } else {
                console.error('Element not found');
            }
            showToast('History cleared.', 'success');

            // Clear history in S3
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
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

    // Function to show toast with improved notifications
    function showToast(message, type = 'info', duration = 5000) {
        const toastId = `toast-${Date.now()}`;
        const toastHTML = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-delay="${duration}">
                <div class="toast-header bg-${type} text-white">
                    <strong class="mr-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                    <button type="button" class="ml-2 mb-1 close text-white" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        $('#toast-container').append(toastHTML);
        $(`#${toastId}`).toast('show').on('hidden.bs.toast', function () {
            $(this).remove();
        });
    }

    // Update the Home link handler
    document.getElementById('home-link').addEventListener('click', function() {
        // Hide all sections except upload section
        document.getElementById('folders-section').classList.add('d-none');
        document.getElementById('history-section').classList.add('d-none');
        document.getElementById('cost-section').classList.add('d-none');
        
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
        document.getElementById('cost-section').classList.add('d-none');
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
        document.getElementById('cost-section').classList.add('d-none');
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
});

// Update the initial state
window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('folders-section').classList.add('d-none');
    document.getElementById('history-section').classList.add('d-none');
    document.getElementById('cost-section').classList.add('d-none');
});

// Update the tab click handlers with null checks
function updateActiveTab(clickedTab) {
    // Hide all sections with null checks
    const sections = ['folders-section', 'history-section', 'cost-section'];
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
        },
        'cost-link': function() {
            updateActiveTab('cost-link');
            $('#costModal').modal('show');
        },
        's3-info-link': function() {
            updateActiveTab('s3-info-link');
            $('#s3InfoModal').modal({
                backdrop: 'static',
                keyboard: true,
                focus: true
            });
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
    const sectionsToHide = ['folders-section', 'history-section', 'cost-section'];
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
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal) {
                modal.removeAttribute('aria-hidden');
            }
        });
    } catch (error) {
        console.error('Error cleaning up modals:', error);
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

// Update the fetchS3Contents function
fetchS3Contents = async function(prefix = '') {
    try {
        currentPrefix = prefix;
        // ...rest of fetchS3Contents implementation...
    } catch (err) {
        console.error('Error in fetchS3Contents:', err);
    }
};

// Update event listeners for modals with error handling
const setupModalHandlers = () => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (modal) {
            $(modal).on('hidden.bs.modal', cleanupModals);
        }
    });
};

// Initialize the application
const initializeApp = async () => {
    try {
        await fetchS3Contents('');
        await loadHistory();
        setupModalHandlers();
    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Error initializing application', 'danger');
    }
};

// Start the initialization
initializeApp();