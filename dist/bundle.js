/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./app.js":
/*!****************!*\
  !*** ./app.js ***!
  \****************/
/***/ (() => {

eval("document.addEventListener('DOMContentLoaded', function() {\r\n    // Configure AWS using secrets from environment variables\r\n    AWS.config.update({\r\n        region: 'ap-south-1',\r\n        credentials: new AWS.Credentials({\r\n            accessKeyId: \"AKIA253CTSFIWAGGHVW2\",\r\n            secretAccessKey: \"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\"\r\n        })\r\n    });\r\n\r\n    // Create S3 service object\r\n    const s3 = new AWS.S3({\r\n        apiVersion: '2006-03-01',\r\n        params: { Bucket: \"awsmusicbackupbucket\" },\r\n        signatureVersion: 'v4'\r\n    });\r\n\r\n    let currentPrefix = '';\r\n    let history = [];\r\n\r\n    // Function to fetch S3 contents\r\n    async function fetchS3Contents(prefix = '') {\r\n        try {\r\n            currentPrefix = prefix;\r\n            const params = {\r\n                Bucket: \"awsmusicbackupbucket\",\r\n                Prefix: prefix,\r\n                Delimiter: '/'\r\n            };\r\n            const data = await s3.listObjectsV2(params).promise();\r\n            const s3Contents = document.getElementById('s3-contents');\r\n            \r\n            if (!data.Contents && !data.CommonPrefixes) {\r\n                if (s3Contents) {\r\n                    s3Contents.innerHTML = '<tr><td colspan=\"3\">No contents found</td></tr>';\r\n                } else {\r\n                    console.error('Element not found');\r\n                }\r\n                return;\r\n            }\r\n\r\n            const folders = data.CommonPrefixes.map(item => `\r\n                <tr>\r\n                    <td>${item.Prefix.split('/').slice(-2, -1)[0]}</td>\r\n                    <td>folder</td>\r\n                    <td>\r\n                        <button class=\"btn btn-secondary navigate-button\" data-prefix=\"${item.Prefix}\">Navigate</button>\r\n                        <button class=\"btn btn-primary download-folder-button\" data-prefix=\"${item.Prefix}\">Download Folder</button>\r\n                    </td>\r\n                </tr>\r\n            `).join('');\r\n\r\n            const files = data.Contents.filter(item => item.Key !== 'history-log.json').map(item => `\r\n                <tr>\r\n                    <td>${item.Key.split('/').pop()}</td>\r\n                    <td>file</td>\r\n                    <td>\r\n                        <button class=\"btn btn-primary download-button\" data-key=\"${item.Key}\">Download</button>\r\n                    </td>\r\n                </tr>\r\n            `).join('');\r\n\r\n            if (s3Contents) {\r\n                s3Contents.innerHTML = folders + files;\r\n            } else {\r\n                console.error('Element not found');\r\n            }\r\n\r\n            // Show or hide the \"Navigate Up\" button\r\n            const navigateUpButton = document.getElementById('navigate-up-button');\r\n            if (navigateUpButton) {\r\n                navigateUpButton.style.display = prefix ? 'block' : 'none';\r\n            } else {\r\n                console.error('Element not found');\r\n            }\r\n        } catch (err) {\r\n            console.error('Error fetching S3 contents:', err);\r\n            showToast('Error fetching S3 contents. Please check console for details.', 'danger');\r\n        }\r\n    }\r\n\r\n    // Function to update history\r\n    async function updateHistory(action, size, fileCount) {\r\n        const date = new Date().toLocaleString();\r\n        history.push({ date, action, size, fileCount });\r\n        const historyContents = document.getElementById('history-contents');\r\n        if (historyContents) {\r\n            historyContents.innerHTML = history.map(item => `\r\n                <tr>\r\n                    <td>${item.date}</td>\r\n                    <td>${item.action}</td>\r\n                    <td>${(item.size / (1024 * 1024)).toFixed(2)} MB</td>\r\n                    <td>${item.fileCount}</td>\r\n                </tr>\r\n            `).join('');\r\n        } else {\r\n            console.error('Element not found');\r\n        }\r\n\r\n        // Save history to S3\r\n        const params = {\r\n            Bucket: \"awsmusicbackupbucket\",\r\n            Key: 'history-log.json',\r\n            Body: JSON.stringify(history),\r\n            ContentType: 'application/json'\r\n        };\r\n        await s3.putObject(params).promise();\r\n    }\r\n\r\n    // Function to load history from S3\r\n    async function loadHistory() {\r\n        try {\r\n            const params = {\r\n                Bucket: \"awsmusicbackupbucket\",\r\n                Key: 'history-log.json'\r\n            };\r\n            const data = await s3.getObject(params).promise();\r\n            history = JSON.parse(data.Body.toString());\r\n            const historyContents = document.getElementById('history-contents');\r\n            if (historyContents) {\r\n                historyContents.innerHTML = history.map(item => `\r\n                    <tr>\r\n                        <td>${item.date}</td>\r\n                        <td>${item.action}</td>\r\n                        <td>${(item.size / (1024 * 1024)).toFixed(2)} MB</td>\r\n                        <td>${item.fileCount}</td>\r\n                    </tr>\r\n                `).join('');\r\n            } else {\r\n                console.error('Element not found');\r\n            }\r\n        } catch (err) {\r\n            console.error('Error loading history:', err);\r\n        }\r\n    }\r\n\r\n    // Function to fetch AWS cost\r\n    async function fetchAWSCost() {\r\n        try {\r\n            const costExplorer = new AWS.CostExplorer({ region: 'us-east-1' });\r\n            const params = {\r\n                TimePeriod: {\r\n                    Start: new Date(new Date().setDate(1)).toISOString().split('T')[0],\r\n                    End: new Date().toISOString().split('T')[0]\r\n                },\r\n                Granularity: 'MONTHLY',\r\n                Metrics: ['UnblendedCost']\r\n            };\r\n            const data = await costExplorer.getCostAndUsage(params).promise();\r\n            const cost = data.ResultsByTime[0].Total.UnblendedCost.Amount;\r\n            const costInINR = (parseFloat(cost) * 75).toFixed(2); // Assuming 1 USD = 75 INR\r\n            showToast(`Total Cost: ₹${costInINR}`, 'info');\r\n        } catch (err) {\r\n            console.error('Error fetching AWS cost:', err);\r\n            showToast('Error fetching AWS cost. Please check console for details.', 'danger');\r\n        }\r\n    }\r\n\r\n    // S3 Info click handler\r\n    document.getElementById('s3-info-link').addEventListener('click', async function() {\r\n        try {\r\n            const params = { Bucket: \"awsmusicbackupbucket\" };\r\n            const objects = await s3.listObjectsV2(params).promise();\r\n            const totalSize = objects.Contents?.reduce((acc, obj) => acc + obj.Size, 0) || 0;\r\n            const fileCount = objects.Contents?.length || 0;\r\n\r\n            const bucketDetails = `\r\n                <div class=\"bucket-info mb-4\">\r\n                    <p>Total Size: ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB</p>\r\n                    <p>File Count: ${fileCount}</p>\r\n                </div>\r\n            `;\r\n\r\n            const s3InfoContent = document.getElementById('s3-info-content');\r\n            if (s3InfoContent) {\r\n                console.log('s3-info-content element found:', s3InfoContent);\r\n                s3InfoContent.innerHTML = bucketDetails;\r\n            } else {\r\n                console.error('Element with ID \"s3-info-content\" not found');\r\n            }\r\n            $('#s3InfoModal').modal('show');\r\n        } catch (error) {\r\n            console.error('Error fetching S3 info:', error);\r\n            if (error.code === 'InvalidAccessKeyId') {\r\n                showToast('Invalid AWS Access Key Id. Please check your credentials.', 'danger');\r\n            } else {\r\n                showToast('Failed to fetch S3 information. Please check console for details.', 'danger');\r\n            }\r\n        }\r\n    });\r\n\r\n    // Upload button handler\r\n    document.getElementById('upload-button').addEventListener('click', async function() {\r\n        const folderInput = document.getElementById('folder-upload');\r\n        const errorMessage = document.getElementById('error-message');\r\n        const progressBar = document.getElementById('upload-progress');\r\n        const progressBarInner = progressBar.querySelector('.progress-bar');\r\n\r\n        if (!folderInput.files.length) {\r\n            if (errorMessage) {\r\n                errorMessage.classList.remove('d-none');\r\n            } else {\r\n                console.error('Element not found');\r\n            }\r\n            return;\r\n        }\r\n\r\n        if (errorMessage) {\r\n            errorMessage.classList.add('d-none');\r\n        } else {\r\n            console.error('Element not found');\r\n        }\r\n        if (progressBar) {\r\n            progressBar.classList.remove('d-none');\r\n        } else {\r\n            console.error('Element not found');\r\n        }\r\n\r\n        try {\r\n            const existingFiles = await s3.listObjectsV2({ Bucket: \"awsmusicbackupbucket\", Prefix: currentPrefix }).promise();\r\n            const existingKeys = new Set(existingFiles.Contents.map(item => item.Key));\r\n            let newFilesCount = 0;\r\n            let totalSize = 0;\r\n\r\n            for (const file of folderInput.files) {\r\n                const key = file.webkitRelativePath || file.name;\r\n                if (!existingKeys.has(key)) {\r\n                    const params = {\r\n                        Bucket: \"awsmusicbackupbucket\",\r\n                        Key: key,\r\n                        Body: file\r\n                    };\r\n                    await s3.upload(params).promise();\r\n                    newFilesCount++;\r\n                    totalSize += file.size;\r\n                }\r\n            }\r\n\r\n            if (newFilesCount === 0) {\r\n                showToast('No new files to upload.', 'warning');\r\n            } else {\r\n                showToast('Folder uploaded successfully.', 'success');\r\n                await updateHistory('Upload', totalSize, newFilesCount);\r\n                await fetchS3Contents(currentPrefix); // Refresh the list\r\n            }\r\n        } catch (err) {\r\n            console.error('Error uploading files:', err);\r\n            showToast('Error uploading files. Please check console for details.', 'danger');\r\n        } finally {\r\n            if (progressBar) {\r\n                progressBar.classList.add('d-none');\r\n            } else {\r\n                console.error('Element not found');\r\n            }\r\n            if (progressBarInner) {\r\n                progressBarInner.style.width = '0%';\r\n            } else {\r\n                console.error('Element not found');\r\n            }\r\n            if (folderInput) {\r\n                folderInput.value = '';\r\n            } else {\r\n                console.error('Element not found');\r\n            }\r\n        }\r\n    });\r\n\r\n    // Navigation and download handlers\r\n    document.getElementById('s3-contents').addEventListener('click', async function(event) {\r\n        if (event.target.classList.contains('navigate-button')) {\r\n            const prefix = event.target.getAttribute('data-prefix');\r\n            await fetchS3Contents(prefix);\r\n        } else if (event.target.classList.contains('download-button')) {\r\n            const key = event.target.getAttribute('data-key');\r\n            try {\r\n                const data = await s3.getObject({\r\n                    Bucket: \"awsmusicbackupbucket\",\r\n                    Key: key\r\n                }).promise();\r\n\r\n                const blob = new Blob([data.Body]);\r\n                const url = window.URL.createObjectURL(blob);\r\n                const a = document.createElement('a');\r\n                a.href = url;\r\n                a.download = key.split('/').pop();\r\n                document.body.appendChild(a);\r\n                a.click();\r\n                window.URL.revokeObjectURL(url);\r\n                document.body.removeChild(a);\r\n\r\n                await updateHistory('Download', data.ContentLength, 1);\r\n            } catch (err) {\r\n                console.error('Error downloading file:', err);\r\n                showToast('Error downloading file. Please check console for details.', 'danger');\r\n            }\r\n        } else if (event.target.classList.contains('download-folder-button')) {\r\n            const prefix = event.target.getAttribute('data-prefix');\r\n            try {\r\n                const params = {\r\n                    Bucket: \"awsmusicbackupbucket\",\r\n                    Prefix: prefix\r\n                };\r\n                const data = await s3.listObjectsV2(params).promise();\r\n                const zip = new JSZip();\r\n                let totalSize = 0;\r\n\r\n                for (const item of data.Contents) {\r\n                    const fileData = await s3.getObject({\r\n                        Bucket: \"awsmusicbackupbucket\",\r\n                        Key: item.Key\r\n                    }).promise();\r\n                    zip.file(item.Key.replace(prefix, ''), fileData.Body);\r\n                    totalSize += fileData.ContentLength;\r\n                }\r\n\r\n                const content = await zip.generateAsync({ type: 'blob' });\r\n                const url = window.URL.createObjectURL(content);\r\n                const a = document.createElement('a');\r\n                a.href = url;\r\n                a.download = `${prefix.split('/').slice(-2, -1)[0]}.zip`;\r\n                document.body.appendChild(a);\r\n                a.click();\r\n                window.URL.revokeObjectURL(url);\r\n                document.body.removeChild(a);\r\n\r\n                await updateHistory('Download', totalSize, data.Contents.length);\r\n            } catch (err) {\r\n                console.error('Error downloading folder:', err);\r\n                showToast('Error downloading folder. Please check console for details.', 'danger');\r\n            }\r\n        }\r\n    });\r\n\r\n    // Navigate Up button handler\r\n    document.getElementById('navigate-up-button').addEventListener('click', function() {\r\n        const parts = currentPrefix.split('/').filter(Boolean);\r\n        if (parts.length > 0) {\r\n            parts.pop();\r\n            fetchS3Contents(parts.join('/') + '/');\r\n        } else {\r\n            fetchS3Contents('');\r\n        }\r\n    });\r\n\r\n    // Folders link handler\r\n    document.getElementById('folders-link').addEventListener('click', function() {\r\n        document.getElementById('folders-section').classList.remove('d-none');\r\n        document.getElementById('history-section').classList.add('d-none');\r\n        fetchS3Contents();\r\n    });\r\n\r\n    // History link handler\r\n    document.getElementById('history-link').addEventListener('click', function() {\r\n        document.getElementById('folders-section').classList.add('d-none');\r\n        document.getElementById('history-section').classList.remove('d-none');\r\n    });\r\n\r\n    // Cost link handler\r\n    document.getElementById('cost-link').addEventListener('click', function() {\r\n        fetchAWSCost();\r\n    });\r\n\r\n    // Home link handler\r\n    document.getElementById('home-link').addEventListener('click', function() {\r\n        document.getElementById('folders-section').classList.add('d-none');\r\n        document.getElementById('history-section').classList.add('d-none');\r\n        const s3Contents = document.getElementById('s3-contents');\r\n        if (s3Contents) {\r\n            s3Contents.innerHTML = '';\r\n        } else {\r\n            console.error('Element not found');\r\n        }\r\n    });\r\n\r\n    // Clear history button handler\r\n    document.getElementById('clear-history-button').addEventListener('click', function() {\r\n        const clearHistoryModal = `\r\n            <div class=\"modal fade\" id=\"clearHistoryModal\" tabindex=\"-1\" role=\"dialog\" aria-labelledby=\"clearHistoryModalLabel\" aria-hidden=\"true\">\r\n                <div class=\"modal-dialog\" role=\"document\">\r\n                    <div class=\"modal-content\">\r\n                        <div class=\"modal-header\">\r\n                            <h5 class=\"modal-title\" id=\"clearHistoryModalLabel\">Clear History</h5>\r\n                            <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-label=\"Close\">\r\n                                <span aria-hidden=\"true\">&times;</span>\r\n                            </button>\r\n                        </div>\r\n                        <div class=\"modal-body\">\r\n                            Are you sure you want to clear the history?\r\n                        </div>\r\n                        <div class=\"modal-footer\">\r\n                            <button type=\"button\" class=\"btn btn-secondary\" data-dismiss=\"modal\">Cancel</button>\r\n                            <button type=\"button\" class=\"btn btn-danger\" id=\"confirm-clear-history\">Clear History</button>\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n        `;\r\n        document.body.insertAdjacentHTML('beforeend', clearHistoryModal);\r\n        $('#clearHistoryModal').modal('show');\r\n\r\n        document.getElementById('confirm-clear-history').addEventListener('click', async function() {\r\n            history = [];\r\n            const historyContents = document.getElementById('history-contents');\r\n            if (historyContents) {\r\n                historyContents.innerHTML = '';\r\n            } else {\r\n                console.error('Element not found');\r\n            }\r\n            showToast('History cleared.', 'success');\r\n\r\n            // Clear history in S3\r\n            const params = {\r\n                Bucket: \"awsmusicbackupbucket\",\r\n                Key: 'history-log.json',\r\n                Body: JSON.stringify(history),\r\n                ContentType: 'application/json'\r\n            };\r\n            await s3.putObject(params).promise();\r\n\r\n            // Hide the modal\r\n            $('#clearHistoryModal').modal('hide');\r\n            $('#clearHistoryModal').on('hidden.bs.modal', function () {\r\n                const clearHistoryModalElement = document.getElementById('clearHistoryModal');\r\n                if (clearHistoryModalElement) {\r\n                    clearHistoryModalElement.remove();\r\n                } else {\r\n                    console.error('Element not found');\r\n                }\r\n            });\r\n        });\r\n    });\r\n\r\n    // Logout button handler\r\n    document.getElementById('logout-button').addEventListener('click', function() {\r\n        // Implement logout functionality here\r\n        alert('Logout button clicked');\r\n    });\r\n\r\n    // Initial fetch of S3 contents\r\n    fetchS3Contents();\r\n\r\n    // Load history from S3\r\n    loadHistory();\r\n\r\n    // Custom file input label update\r\n    $('#folder-upload').on('change', function() {\r\n        var fileName = $(this).val().split('\\\\').pop();\r\n        $(this).next('.custom-file-label').addClass('selected').html(fileName);\r\n    });\r\n\r\n    // Function to show toast\r\n    function showToast(message, type) {\r\n        const toastHTML = `\r\n            <div class=\"toast\" role=\"alert\" aria-live=\"assertive\" aria-atomic=\"true\" data-delay=\"5000\">\r\n                <div class=\"toast-header\">\r\n                    <strong class=\"mr-auto\">${type === 'success' ? 'Success' : type === 'info' ? 'Info' : 'Error'}</strong>\r\n                    <button type=\"button\" class=\"ml-2 mb-1 close\" data-dismiss=\"toast\" aria-label=\"Close\">\r\n                        <span aria-hidden=\"true\">&times;</span>\r\n                    </button>\r\n                </div>\r\n                <div class=\"toast-body\">\r\n                    ${message}\r\n                </div>\r\n            </div>\r\n        `;\r\n        $('#toast-container').append(toastHTML);\r\n        $('.toast').toast('show');\r\n    }\r\n});\n\n//# sourceURL=webpack:///./app.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./app.js"]();
/******/ 	
/******/ })()
;