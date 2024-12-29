document.addEventListener('DOMContentLoaded', function() {
    // Configure AWS using secrets from environment variables
    AWS.config.update({
        region: 'ap-south-1',
        credentials: new AWS.Credentials({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        })
    });

    // Create S3 service object
    const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        params: { Bucket: process.env.AWS_BUCKET_NAME },
        signatureVersion: 'v4'
    });

    let currentPrefix = '';
    let history = [];

    // Function to fetch S3 contents
    async function fetchS3Contents(prefix = '') {
        try {
            currentPrefix = prefix;
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Prefix: prefix,
                Delimiter: '/'
            };
            const data = await s3.listObjectsV2(params).promise();
            const s3Contents = document.getElementById('s3-contents');
            
            if (!data.Contents && !data.CommonPrefixes) {
                if (s3Contents) {
                    s3Contents.innerHTML = '<tr><td colspan="3">No contents found</td></tr>';
                } else {
                    console.error('Element not found');
                }
                return;
            }

            const folders = data.CommonPrefixes.map(item => `
                <tr>
                    <td>${item.Prefix.split('/').slice(-2, -1)[0]}</td>
                    <td>folder</td>
                    <td>
                        <button class="btn btn-secondary navigate-button" data-prefix="${item.Prefix}">Navigate</button>
                        <button class="btn btn-primary download-folder-button" data-prefix="${item.Prefix}">Download Folder</button>
                    </td>
                </tr>
            `).join('');

            const files = data.Contents.filter(item => item.Key !== 'history-log.json').map(item => `
                <tr>
                    <td>${item.Key.split('/').pop()}</td>
                    <td>file</td>
                    <td>
                        <button class="btn btn-primary download-button" data-key="${item.Key}">Download</button>
                    </td>
                </tr>
            `).join('');

            if (s3Contents) {
                s3Contents.innerHTML = folders + files;
            } else {
                console.error('Element not found');
            }

            // Show or hide the "Navigate Up" button
            const navigateUpButton = document.getElementById('navigate-up-button');
            if (navigateUpButton) {
                navigateUpButton.style.display = prefix ? 'block' : 'none';
            } else {
                console.error('Element not found');
            }
        } catch (err) {
            console.error('Error fetching S3 contents:', err);
            showToast('Error fetching S3 contents. Please check console for details.', 'danger');
        }
    }

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

    // S3 Info click handler
    document.getElementById('s3-info-link').addEventListener('click', async function() {
        try {
            const params = { Bucket: process.env.AWS_BUCKET_NAME };
            const objects = await s3.listObjectsV2(params).promise();
            const totalSize = objects.Contents?.reduce((acc, obj) => acc + obj.Size, 0) || 0;
            const fileCount = objects.Contents?.length || 0;
            const folderCount = objects.CommonPrefixes?.length || 0;

            // Calculate the number of files in each folder
            const folderFileCounts = {};
            objects.Contents.forEach(obj => {
                const folder = obj.Key.split('/')[0];
                if (!folderFileCounts[folder]) {
                    folderFileCounts[folder] = 0;
                }
                folderFileCounts[folder]++;
            });

            const folderDetails = Object.entries(folderFileCounts).map(([folder, count]) => `
                <p>Folder: ${folder}, File Count: ${count}</p>
            `).join('');

            const bucketDetails = `
                <div class="bucket-info mb-4">
                    <p>Total Size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB</p>
                    <p>File Count: ${fileCount}</p>
                    <p>Folder Count: ${folderCount}</p>
                    <p>Total Items: ${fileCount + folderCount}</p>
                    ${folderDetails}
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

            for (const file of folderInput.files) {
                const key = file.webkitRelativePath || file.name;
                if (!existingKeys.has(key)) {
                    const params = {
                        Bucket: process.env.AWS_BUCKET_NAME,
                        Key: key,
                        Body: file
                    };
                    await s3.upload(params).promise();
                    newFilesCount++;
                    totalSize += file.size;
                }
            }

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
        fetchS3Contents();
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

    // Function to show toast
    function showToast(message, type) {
        const toastHTML = `
            <div class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-delay="5000">
                <div class="toast-header">
                    <strong class="mr-auto">${type === 'success' ? 'Success' : 'Error'}</strong>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        $('#toast-container').append(toastHTML);
        $('.toast').toast('show');
    }
});
