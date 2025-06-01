sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ushell/services/UserInfo"
], function (BaseController, formatter, JSONModel, MessageBox, Filter, FilterOperator, Fragment, UserInfo) {
    "use strict";

    return BaseController.extend("bsim.hcmapp.man.movement.controller.DetailApproval", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._oDetailApprovalModel = new JSONModel();
            this.getView().setModel(this._oDetailApprovalModel, "detailApprovalModel");
            this.getView().byId("downloadDisposisi").bindElement({
                path: "/",
                model: "detailApprovalModel",
            });

            const oButtonStateModel = new sap.ui.model.json.JSONModel({
                isApproveEnabled: true,
                isRejectEnabled: true
            });
            this.getView().setModel(oButtonStateModel, "buttonState");

            this.getRouter().getRoute("detailapproval").attachPatternMatched(this._onDetailApprovalRouteMatched, this);

            const oDropdownModel = new sap.ui.model.json.JSONModel({
                asColl: [
                    { key: "1", text: "Baru" },
                    { key: "2", text: "Pengganti" }
                ],
                salaryAdjColl : [
                    { key: "1", text: "Ya"},
                    { key: "2", text: "Tidak"}
                ]
            });
            this.getView().setModel(oDropdownModel, "dropdown");

            const oHasilApprovalModel = new sap.ui.model.json.JSONModel({
                hasilApproval1: false,
                hasilApproval2: false,
                hasilApproval3: false,
                hasilApproval4: false,
                hasilApproval5: false
            });
            this.getView().setModel(oHasilApprovalModel, "hasilApproval");

            var oVerificationModel = new sap.ui.model.json.JSONModel({
                isAssessmentEnabled: false,
                isBiCheckingEnabled: false,
                isDisposisiEnabled: false,
                isSubmitVisible: false,
                isUploadVisible: false
            });
            this.getView().setModel(oVerificationModel, "verificationModel");

            let oDisposisiApprovalModel = new JSONModel({
                selectedIndex: 0
            });
            this._oView.setModel(oDisposisiApprovalModel, "disposisiApproval1");

            // Set the Grievances OData model
            const oGrievancesModel = this.getOwnerComponent().getModel("Grievances");
            if (!oGrievancesModel) {
                console.error("Grievances model is not available.");
                return;
            }

            oGrievancesModel.read("/RequestSet", {
                urlParameters: {
                    "$expand": "toAttachmentView", 
                    "$orderby": "CreatedOn desc, CreatedAt desc" 
                },
                success: (oData) => {
                    console.log("Grievances data with attachments loaded successfully:", oData);
            
                    const aRequests = oData.results || [];
                    const sEmployeeNumber = this.getView().getModel("employee").getProperty("/EmployeeNumber");
            
                    if (!sEmployeeNumber) {
                        console.error("Employee number is missing in the 'employee' model.");
                        this.getView().setModel(new sap.ui.model.json.JSONModel({ hasRequest: false }), "FilteredAttachments");
                        return;
                    }
            
                    const aFilteredRequests = aRequests.filter(request => request.EmployeeNumber === sEmployeeNumber);
            
                    if (aFilteredRequests.length === 0) {
                        console.warn(`No requests found for EmployeeNumber: ${sEmployeeNumber}`);
                        // Set hasRequest to false and hide the button
                        const oAttachmentModel = new sap.ui.model.json.JSONModel({ hasRequest: false });
                        this.getView().setModel(oAttachmentModel, "FilteredAttachments");
                        return;
                    }
            
                    const oLatestRequest = aFilteredRequests[0]; // The first request is the newest due to sorting
                    console.log("Most recent request:", oLatestRequest);
            
                    // Process attachments from the newest request
                    const aAttachments = oLatestRequest.toAttachmentView?.results || [];
                    const aFilteredAttachments = aAttachments.filter(attachment => attachment.TypeDoc === "ST/SP Baru");
            
                    const oAttachmentModel = new sap.ui.model.json.JSONModel({
                        hasRequest: aFilteredAttachments.length > 0,
                        attachments: aFilteredAttachments
                    });
                    this.getView().setModel(oAttachmentModel, "FilteredAttachments");
            
                    if (aFilteredAttachments.length > 0) {
                        console.log("Filtered Attachments with TypeDoc 'ST/SP Baru':", aFilteredAttachments);
                    } else {
                        console.warn("No attachments with TypeDoc 'ST/SP Baru' found.");
                    }
                },
                error: (oError) => {
                    console.error("Error loading grievances data with attachments:", oError);
                    const oAttachmentModel = new sap.ui.model.json.JSONModel({ hasRequest: false });
                    this.getView().setModel(oAttachmentModel, "FilteredAttachments");
                }
            });
        },

        _onDetailApprovalRouteMatched: function (oEvent) {
            const sRequestId = oEvent.getParameter("arguments").RequestId;
            console.log("Route-matched Request ID:", sRequestId);
        
            if (!this._isValidGuid(sRequestId)) {
                console.error("Invalid Request ID format:", sRequestId);
                MessageBox.error("Invalid Request ID format");
                return;
            }
        
            console.log("Valid Request ID:", sRequestId);
        
            // Set the RequestId in the detailApprovalModel
            this._oDetailApprovalModel.setProperty("/RequestId", sRequestId);
        
            // Dynamically determine the model
            this._determineModelForRequestId(sRequestId)
                .then((oSelectedModel) => {
                    this._oSelectedModel = oSelectedModel;
                    console.log("Selected model:", (() => {
                        const aModelChecks = [
                            { name: "Promotion", model: this.getOwnerComponent().getModel("Promotion") },
                            { name: "Movement", model: this.getOwnerComponent().getModel() },
                            { name: "Demotion", model: this.getOwnerComponent().getModel("Demotion") },
                            { name: "Assignment", model: this.getOwnerComponent().getModel("Assignment") },
                            { name: "StatusChange", model: this.getOwnerComponent().getModel("StatusChange") },
                            { name: "Acting", model: this.getOwnerComponent().getModel("Acting") }
                        ];
                    
                        const oMatchedModel = aModelChecks.find(entry => entry.model === this._oSelectedModel);
                        return oMatchedModel ? oMatchedModel.name : "Unknown";
                    })());
        
                    this._getDetailApprovalData(sRequestId);
                    this.loadApprovalHistoryWithRequestor(sRequestId);
                    this._currentUser(sRequestId)
                        .then(() => {
                            console.log("Verification access set successfully.");
                        })
                        .catch((error) => {
                            console.error("Error setting verification access:", error);
                        });
                        const oUploadSet = this.byId("idUploadSet");
                            if (oUploadSet) {
                                oUploadSet.removeAllItems();
                            }
                            
                        const oFileAttachmentModel = this.getView().getModel("fileAttachment");
                            if (oFileAttachmentModel) {
                                oFileAttachmentModel.setProperty("/results", []);
                            }
                })
                .catch((error) => {
                    console.error("Error determining model for RequestId:", error);
                    MessageBox.error("Failed to determine the model for the given Request ID.");
                });
            
                this._getDetailApprovalData(sRequestId).then(() => {
                    this._updateDisposisiSelection();
                });
        },
        
        _determineModelForRequestId: function (sRequestId) {
            return new Promise((resolve, reject) => {
                const oPromotionModel = this.getOwnerComponent().getModel("Promotion");
                const oMovementModel = this.getOwnerComponent().getModel();
                const oDemotionModel = this.getOwnerComponent().getModel("Demotion");
                const oAssignmentModel = this.getOwnerComponent().getModel("Assignment");
                const oStatusChangeModel = this.getOwnerComponent().getModel("StatusChange");
                const oActingModel = this.getOwnerComponent().getModel("Acting");
        
                const aModelChecks = [
                    { name: "Promotion", model: oPromotionModel },
                    { name: "Movement", model: oMovementModel },
                    { name: "Demotion", model: oDemotionModel },
                    { name: "Assignment", model: oAssignmentModel },
                    { name: "StatusChange", model: oStatusChangeModel },
                    { name: "Acting", model: oActingModel }
                ];
        
                let bModelFound = false;
        
                const checkModel = (oModelEntry) => {
                    return new Promise((resolveCheck) => {
                        if (!oModelEntry.model) {
                            console.warn(`OData model '${oModelEntry.name}' not available.`);
                            resolveCheck(null);
                            return;
                        }
        
                        const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
                        oModelEntry.model.read(sRequestPath, {
                            success: function (oData) {
                                console.log(`RequestId found in ${oModelEntry.name} model:`, oData);
                                resolveCheck(oModelEntry.model); 
                            },
                            error: function (oError) {
                                console.warn(`RequestId not found in ${oModelEntry.name} model.`, oError);
                                resolveCheck(null); 
                            }
                        });
                    });
                };
        
                // Check all models in parallel
                Promise.all(aModelChecks.map(checkModel))
                    .then((aResults) => {
                        const oSelectedModel = aResults.find((model) => model !== null); 
                        if (oSelectedModel) {
                            resolve(oSelectedModel);
                        } else {
                            reject(new Error("RequestId not found in any model."));
                        }
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
        },

        _updateDisposisiSelection: function () {
            const sDisposisi = this._oDetailApprovalModel.getProperty("/Zdisposisi");
            const iSelectedIndex = sDisposisi === "1" ? 0 : 1; 
            this.getView().getModel("disposisiApproval1").setProperty("/selectedIndex", iSelectedIndex);
        },

        onDisplayDocumentWarning: function () {
            const oEmployeeModel = this.getView().getModel("employee");
            const sEmployeeNumber = oEmployeeModel ? oEmployeeModel.getProperty("/EmployeeNumber") : null;
        
            if (!sEmployeeNumber) {
                console.error("Employee number is missing in the 'employee' model.");
                sap.m.MessageBox.error("Employee number is missing. Cannot fetch document.");
                return;
            }
        
            console.log("Fetching requests for EmployeeNumber:", sEmployeeNumber);
        
            const oModel = this.getOwnerComponent().getModel("Grievances");
            if (!oModel) {
                console.error("Grievances model is not available.");
                sap.m.MessageBox.error("System error: Grievances model is not available.");
                return;
            }
        
            oModel.read("/RequestSet", {
                filters: [new sap.ui.model.Filter("EmployeeNumber", sap.ui.model.FilterOperator.EQ, sEmployeeNumber)],
                urlParameters: {
                    "$orderby": "CreatedOn desc, CreatedAt desc" // Sort by CreatedOn and CreatedAt descending
                },
                success: (oData) => {
                    console.log("Requests fetched successfully:", oData);
        
                    const aRequests = oData.results || [];
                    const aFilteredRequests = aRequests.filter(request => request.EmployeeNumber === sEmployeeNumber);
        
                    if (aFilteredRequests.length === 0) {
                        console.warn(`No requests found for EmployeeNumber: ${sEmployeeNumber}`);
                        sap.m.MessageBox.error(`No requests found for EmployeeNumber: ${sEmployeeNumber}`);
                        return;
                    }
        
                    const oLatestRequest = aFilteredRequests[0]; // The first request is the newest due to sorting
                    console.log("Most recent request:", oLatestRequest);
        
                    const sExpandPath = `/RequestSet(guid'${oLatestRequest.RequestId}')/toAttachmentView`;
                    console.log("Expanding to path:", sExpandPath);
        
                    oModel.read(sExpandPath, {
                        success: (oAttachmentData) => {
                            console.log("Attachments fetched successfully:", oAttachmentData);
        
                            if (!oAttachmentData.results || oAttachmentData.results.length === 0) {
                                console.warn("No attachments found for the latest request.");
                                sap.m.MessageBox.error("No attachments found for the latest request.");
                                return;
                            }
        
                            const oSelectedAttachment = oAttachmentData.results.reduce((highest, current) => {
                                return current.SequenceNo > highest.SequenceNo ? current : highest;
                            });
        
                            console.log("Selected attachment with highest SequenceNo:", oSelectedAttachment);
        
                            if (!oSelectedAttachment || !oSelectedAttachment.Url) {
                                console.warn("No valid document URL found in the attachments.");
                                sap.m.MessageBox.error("No valid document URL found in the attachments.");
                                return;
                            }
        
                            const sDocumentUrl = oSelectedAttachment.Url;
                            console.log("Opening document URL:", sDocumentUrl);
                            window.open(sDocumentUrl, "_blank");
                        },
                        error: (oError) => {
                            console.error("Error fetching attachments:", oError);
                            sap.m.MessageBox.error("Failed to fetch attachments for the latest request.");
                        }
                    });
                },
                error: (oError) => {
                    console.error("Error fetching requests:", oError);
                    sap.m.MessageBox.error("Failed to fetch requests for the given employee.");
                }
            });
        },

        // _onDetailApprovalRouteMatched: function (oEvent) {
        //     const sRequestId = oEvent.getParameter("arguments").RequestId;
        //     console.log("Route-matched Request ID:", sRequestId);
        
        //     if (!this._isValidGuid(sRequestId)) {
        //         console.error("Invalid Request ID format:", sRequestId);
        //         MessageBox.error("Invalid Request ID format");
        //         return;
        //     }
        
        //     console.log("Valid Request ID:", sRequestId);
        
        //     // Set the RequestId in the detailApprovalModel
        //     this._oDetailApprovalModel.setProperty("/RequestId", sRequestId);
        
        //     // Fetch data for the request
        //     this._getDetailApprovalData(sRequestId);
        //     this.loadApprovalHistoryWithRequestor(sRequestId);
        //     // this.loadSubmittedDocuments(sRequestId);
        
        //     if (!this._oSelectedModel) {
        //         // console.warn("No OData model selected. Attempting to determine the model dynamically.");
        //         const oPromotionModel = this.getOwnerComponent().getModel("Promotion");
        //         const oMovementModel = this.getOwnerComponent().getModel();
            
        //         if (oMovementModel) {
        //             this._oSelectedModel = oMovementModel;
        //             console.log("Movement model selected dynamically.");
        //         } else if (oPromotionModel) {
        //             this._oSelectedModel = oPromotionModel;
        //             console.log("Promotion model selected dynamically.");
        //         } else {
        //             console.error("No OData models available.");
        //             MessageBox.error("System error: No OData models available.");
        //             return;
        //         }
        //     }
            
        //     this._currentUser(sRequestId)
        //         .then((oCurrentUser) => {
        //             if (oCurrentUser) {
        //                 this._setVerificationAccess();
        //             } else {
        //                 console.error("Current user data is not available.");
        //                 MessageBox.error("Failed to retrieve current user data. Access rights cannot be set.");
        //             }
        //         })
        //         .catch((error) => {
        //             console.error("Error initializing current user:", error);
        //             MessageBox.error("An error occurred while initializing the current user.");
        //         });

        //     // Clear any existing files in the upload set
        //     const oUploadSet = this.byId("idUploadSet");
        //     if (oUploadSet) {
        //         oUploadSet.removeAllItems();
        //     }
            
        //     // Reset the file attachment model
        //     const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     if (oFileAttachmentModel) {
        //         oFileAttachmentModel.setProperty("/results", []);
        //     }
        // },

        // _onDetailApprovalRouteMatched: function (oEvent) {
        //     var sRequestId = oEvent.getParameter("arguments").RequestId;
        //     if (this._isValidGuid(sRequestId)) {
        //         this._getDetailApprovalData(sRequestId);
        //         this.loadApprovalHistoryWithRequestor(sRequestId);
        //         this.loadSubmittedDocuments(sRequestId);
        //     } else {
        //         console.error("Invalid Request ID format");
        //         MessageBox.error("Invalid Request ID format");
        //     }

        //     this.loadApprovalHistory(sRequestId);
        // },

        _isValidGuid: function (sGuid) {
            var guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            return guidRegex.test(sGuid);
        },

        _getDetailApprovalData: function (sRequestId) {
            if (!sRequestId || !this._isValidGuid(sRequestId)) {
                MessageBox.error("Invalid Request ID format. Cannot fetch details.");
                return;
            }
        
            const aODataModels = [
                { name: "Promotion", model: this.getOwnerComponent().getModel("Promotion") },
                { name: "Movement", model: this.getOwnerComponent().getModel() },
                { name: "Demotion", model: this.getOwnerComponent().getModel("Demotion") },
                { name: "Assignment", model: this.getOwnerComponent().getModel("Assignment") },
                { name: "StatusChange", model: this.getOwnerComponent().getModel("StatusChange") },
                { name: "Acting", model: this.getOwnerComponent().getModel("Acting") }
            ];
        
            this._oBusy.open();
        
            const fetchData = (oModelEntry) => {
                return new Promise((resolve, reject) => {
                    const oModel = oModelEntry.model;
                    if (!oModel) {
                        console.warn(`OData model '${oModelEntry.name}' not available.`);
                        resolve(null);
                        return;
                    }
        
                    const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
                    oModel.read(sRequestPath, {
                        success: function (oRequestData) {
                            console.log("RequestSet data retrieved successfully:", oRequestData);
                            this._oSelectedModel = oModel; 
        
                            const sEmployeeNumber = oRequestData.EmployeeNumber;
                            const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;
                            oModel.read(sEmployeePath, {
                                success: function (oEmployeeData) {
                                    console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
                                    const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
                                    oModel.read(sApprovalPath, {
                                        success: function (oApprovalData) {
                                            console.log("Approval data retrieved successfully:", oApprovalData.results);
        
                                            const sAttachmentPath = `/FileAttachmentViewSet`;
                                            const aFilters = [
                                                new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
                                            ];
                                            this._oSelectedModel.read(sAttachmentPath, {
                                                filters: aFilters,
                                                success: function (oAttachmentData) {
                                                    console.log("Attachment data retrieved successfully from FileAttachmentViewSet:", oAttachmentData.results);
        
                                                    const aAttachments = oAttachmentData.results || [];
                                                    if (aAttachments.length === 0) {
                                                        console.log("No attachments found for the given RequestId.");
                                                    }

                                                    const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: aAttachments });
                                                    this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");
        
                                                    // Combine data from RequestSet, EmployeeDetailSet, toApproval, and FileAttachmentViewSet
                                                    const oCombinedData = Object.assign({}, oRequestData, oEmployeeData, {
                                                        ApprovalHistory: oApprovalData.results,
                                                        Attachments: aAttachments
                                                    });
        
                                                    resolve(oCombinedData);
                                                }.bind(this),
                                                error: function (oError) {
                                                    console.error("Error retrieving attachment data from FileAttachmentViewSet:", oError);
                                                    reject(oError);
                                                }.bind(this)
                                            });
                                        }.bind(this),
                                        error: function (oError) {
                                            console.error("Error retrieving approval data:", oError);
                                            reject(oError);
                                        }.bind(this)
                                    });
                                }.bind(this),
                                error: function (oError) {
                                    console.error("Error retrieving EmployeeDetailSet data:", oError);
                                    reject(oError);
                                }.bind(this)
                            });
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error retrieving RequestSet data:", oError);
                            if (oError.responseText) {
                                try {
                                    const oErrorResponse = JSON.parse(oError.responseText);
                                    console.error("Error details:", oErrorResponse.error.message.value);
                                } catch (e) {
                                    console.error("Failed to parse error response:", e);
                                }
                            }
                            reject(oError);
                        }.bind(this)
                    });
                });
            };
        
            const aPromises = aODataModels.map(fetchData);
        
            Promise.allSettled(aPromises)
                .then((aResults) => {
                    // Filter out successful results
                    const aSuccessfulResults = aResults
                        .filter(result => result.status === "fulfilled" && result.value !== null)
                        .map(result => result.value);
        
                    if (aSuccessfulResults.length > 0) {
                        // Use the first successful result
                        const oCombinedData = aSuccessfulResults[0];
                        console.log("Combined data retrieved successfully:", oCombinedData);
        
                        // Set the combined data in the DetailApprovalModel
                        this._oDetailApprovalModel.setData(oCombinedData);
                    } else {
                        MessageBox.error("Failed to load request data from all services.");
                    }
                })
                .catch((oError) => {
                    console.error("Unexpected error:", oError);
                    MessageBox.error("An unexpected error occurred while loading request data.");
                })
                .finally(() => {
                    this._oBusy.close();
                });
        },

        // _getDetailApprovalData: function (sRequestId) {
        //     if (!sRequestId || !this._isValidGuid(sRequestId)) {
        //         MessageBox.error("Invalid Request ID format. Cannot fetch details.");
        //         return;
        //     }
        
        //     const aODataModels = [
        //         { name: "Promotion", model: this.getOwnerComponent().getModel("Promotion") },
        //         { name: "Movement", model: this.getOwnerComponent().getModel() }
        //     ];
        
        //     this._oBusy.open();
        
        //     // Function to fetch data from a model
        //     const fetchData = (oModelEntry) => {
        //         return new Promise((resolve) => {
        //             const oModel = oModelEntry.model;
        //             if (!oModel) {
        //                 console.warn(`OData model '${oModelEntry.name}' not available.`);
        //                 resolve(null);
        //                 return;
        //             }
        
        //             // Fetch data from RequestSet
        //             const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
        //             oModel.read(sRequestPath, {
        //                 success: function (oRequestData) {
        //                     console.log("RequestSet data retrieved successfully:", oRequestData);
        //                     this._oSelectedModel = oModel;
        
        //                     // Fetch data from EmployeeDetailSet
        //                     const sEmployeeNumber = oRequestData.EmployeeNumber;
        //                     const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;
        //                     oModel.read(sEmployeePath, {
        //                         success: function (oEmployeeData) {
        //                             console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
        //                             // Fetch approval data from toApproval navigation property
        //                             const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                             oModel.read(sApprovalPath, {
        //                                 success: function (oApprovalData) {
        //                                     console.log("Approval data retrieved successfully:", oApprovalData.results);
        
        //                                     // Fetch attachment data from /FileAttachmentViewSet
        //                                     const sAttachmentPath = `/FileAttachmentViewSet`;
        //                                     const aFilters = [
        //                                         new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
        //                                     ];
        //                                     oModel.read(sAttachmentPath, {
        //                                         filters: aFilters,
        //                                         success: function (oAttachmentData) {
        //                                             console.log("Attachment data retrieved successfully from FileAttachmentViewSet:", oAttachmentData.results);

        //                                             if (!oAttachmentData.results || oAttachmentData.results.length === 0) {
        //                                                 console.warn("No attachments found for the given RequestId.");
        //                                                 oAttachmentData.results = []; // Ensure an empty array is set
        //                                             }
        
        //                                             // Combine data from RequestSet, EmployeeDetailSet, toApproval, and FileAttachmentViewSet
        //                                             const oCombinedData = Object.assign({}, oRequestData, oEmployeeData, {
        //                                                 ApprovalHistory: oApprovalData.results,
        //                                                 Attachments: oAttachmentData.results
        //                                             });
        
        //                                             // Resolve the combined data
        //                                             resolve(oCombinedData);
        //                                         }.bind(this),
        //                                         error: function (oError) {
        //                                             console.error("Error retrieving attachment data from FileAttachmentViewSet:", oError);
        //                                             resolve(null);
        //                                         }.bind(this)
        //                                     });
        //                                 }.bind(this),
        //                                 error: function (oError) {
        //                                     console.error("Error retrieving approval data:", oError);
        //                                     resolve(null);
        //                                 }.bind(this)
        //                             });
        //                         }.bind(this),
        //                         error: function (oError) {
        //                             console.error("Error retrieving EmployeeDetailSet data:", oError);
        //                             resolve(null);
        //                         }.bind(this)
        //                     });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error retrieving RequestSet data:", oError);
        //                     resolve(null);
        //                 }.bind(this)
        //             });
        //         });
        //     };
        
        //     // Try fetching data from each model
        //     const aPromises = aODataModels.map(fetchData);
        
        //     Promise.allSettled(aPromises)
        //         .then((aResults) => {
        //             // Filter out successful results
        //             const aSuccessfulResults = aResults
        //                 .filter(result => result.status === "fulfilled" && result.value !== null)
        //                 .map(result => result.value);

        //             if (aSuccessfulResults.length > 0) {
        //                 // Use the first successful result
        //                 const oCombinedData = aSuccessfulResults[0];
        //                 console.log("Combined data retrieved successfully:", oCombinedData);

        //                 // Set the combined data in the DetailApprovalModel
        //                 this._oDetailApprovalModel.setData(oCombinedData);
        //             } else {
        //                 // If no successful results, show an error message
        //                 MessageBox.error("Failed to load request data from all services.");
        //             }
        //         })
        //         .catch((oError) => {
        //             console.error("Unexpected error:", oError);
        //             MessageBox.error("An unexpected error occurred while loading request data.");
        //         })
        //         .finally(() => {
        //             this._oBusy.close();
        //         });
        // },

        // _getDetailApprovalData: function (sRequestId) {
        //     if (!sRequestId || !this._isValidGuid(sRequestId)) {
        //         MessageBox.error("Invalid Request ID format. Cannot fetch details.");
        //         return;
        //     }
        
        //     const aODataModels = [
        //         this.getOwnerComponent().getModel("Promotion"), // Promotion OData service
        //         this.getOwnerComponent().getModel() // Movement OData service
        //     ];
        
        //     this._oBusy.open();
        
        //     // Function to fetch data from a model
        //     const fetchData = (oModel) => {
        //         return new Promise((resolve) => {
        //             if (!oModel) {
        //                 console.warn("OData model not available.");
        //                 resolve(null);
        //                 return;
        //             }
        
        //             // Fetch data from RequestSet
        //             const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
        //             oModel.read(sRequestPath, {
        //                 success: function (oRequestData) {
        //                     console.log("RequestSet data retrieved successfully:", oRequestData);
        
        //                     // Fetch data from EmployeeDetailSet
        //                     const sEmployeeNumber = oRequestData.EmployeeNumber;
        //                     const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;
        //                     oModel.read(sEmployeePath, {
        //                         success: function (oEmployeeData) {
        //                             console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
        //                             // Fetch approval data from toApproval navigation property
        //                             const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                             oModel.read(sApprovalPath, {
        //                                 success: function (oApprovalData) {
        //                                     console.log("Approval data retrieved successfully:", oApprovalData.results);
        
        //                                     // Fetch attachment data from /FileAttachmentViewSet
        //                                     const sAttachmentPath = `/FileAttachmentViewSet`;
        //                                     const aFilters = [
        //                                         new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
        //                                     ];
        //                                     oModel.read(sAttachmentPath, {
        //                                         filters: aFilters,
        //                                         success: function (oAttachmentData) {
        //                                             console.log("Attachment data retrieved successfully from FileAttachmentViewSet:", oAttachmentData.results);

        //                                             if (!oAttachmentData.results || oAttachmentData.results.length === 0) {
        //                                                 console.warn("No attachments found for the given RequestId.");
        //                                                 oAttachmentData.results = []; // Ensure an empty array is set
        //                                             }
        
        //                                             // Combine data from RequestSet, EmployeeDetailSet, toApproval, and FileAttachmentViewSet
        //                                             const oCombinedData = Object.assign({}, oRequestData, oEmployeeData, {
        //                                                 ApprovalHistory: oApprovalData.results,
        //                                                 Attachments: oAttachmentData.results
        //                                             });
        
        //                                             // Resolve the combined data
        //                                             resolve(oCombinedData);
        //                                         }.bind(this),
        //                                         error: function (oError) {
        //                                             console.error("Error retrieving attachment data from FileAttachmentViewSet:", oError);
        //                                             resolve(null);
        //                                         }.bind(this)
        //                                     });
        //                                 }.bind(this),
        //                                 error: function (oError) {
        //                                     console.error("Error retrieving approval data:", oError);
        //                                     resolve(null);
        //                                 }.bind(this)
        //                             });
        //                         }.bind(this),
        //                         error: function (oError) {
        //                             console.error("Error retrieving EmployeeDetailSet data:", oError);
        //                             resolve(null);
        //                         }.bind(this)
        //                     });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error retrieving RequestSet data:", oError);
        //                     resolve(null);
        //                 }.bind(this)
        //             });
        //         });
        //     };
        
        //     // Try fetching data from each model
        //     const aPromises = aODataModels.map(fetchData);
        
        //     Promise.allSettled(aPromises)
        //         .then((aResults) => {
        //             // Filter out successful results
        //             const aSuccessfulResults = aResults
        //                 .filter(result => result.status === "fulfilled" && result.value !== null)
        //                 .map(result => result.value);

        //             if (aSuccessfulResults.length > 0) {
        //                 // Use the first successful result
        //                 const oCombinedData = aSuccessfulResults[0];
        //                 console.log("Combined data retrieved successfully:", oCombinedData);

        //                 // Set the combined data in the DetailApprovalModel
        //                 this._oDetailApprovalModel.setData(oCombinedData);
        //             } else {
        //                 // If no successful results, show an error message
        //                 MessageBox.error("Failed to load request data from all services.");
        //             }
        //         })
        //         .catch((oError) => {
        //             console.error("Unexpected error:", oError);
        //             MessageBox.error("An unexpected error occurred while loading request data.");
        //         })
        //         .finally(() => {
        //             this._oBusy.close();
        //         });
        // },

        // _getDetailApprovalData: function (sRequestId) {
        //     var that = this;
        //     var oModel = this.getView().getModel();
        //     this._oBusy.open();
            
        //     oModel.read(`/RequestSet(guid'${sRequestId}')`, {
        //         success: function (oRequestData) {
        //             console.log("RequestSet data retrieved successfully:", oRequestData);
        
        //             var sEmployeeNumber = oRequestData.EmployeeNumber;
        //             oModel.read(`/EmployeeDetailSet('${sEmployeeNumber}')`, {
        //                 success: function (oEmployeeData) {
        //                     console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
        //                     var oCombinedData = Object.assign({}, oRequestData, oEmployeeData);
        
        //                     that._oDetailApprovalModel.setData(oCombinedData);
        //                     that._oBusy.close();
        //                 },
        //                 error: function (oError) {
        //                     console.error("Error retrieving EmployeeDetailSet data:", oError);
        //                     MessageBox.error("Failed to load employee data");
        //                     that._oBusy.close();
        //                 }
        //             });
        //         },
        //         error: function (oError) {
        //             console.error("Error retrieving RequestSet data:", oError);
        //             MessageBox.error("Failed to load request data");
        //             that._oBusy.close();
        //         }
        //     });
        // },

        // loadSubmittedDocuments: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot fetch documents.");
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel();
        //     const oView = this.getView();

        //     const sPath = `/FileAttachmentViewSet`;
        
        //     const aFilters = [
        //         new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
        //     ];
        
        //     oModel.read(sPath, {
        //         filters: aFilters,
        //         success: function (oData) {
        //             console.log("Documents fetched successfully from FileAttachmentViewSet:", oData.results);
        
        //             const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
        //             oView.setModel(oFileAttachmentModel, "fileAttachmentView");
        //         },
        //         error: function (oError) {
        //             console.error("Error fetching documents from FileAttachmentViewSet:", oError);
        //             MessageBox.error("Failed to fetch submitted documents.");
        //         }
        //     });
        // },

        onShowDocument: function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("fileAttachmentView");
        
            const sUrl = oContext.getProperty("Url");
        
            if (sUrl) {
                window.open(sUrl, "_blank");
            } else {
                sap.m.MessageToast.show("No URL available for this document.");
            }
        },

        onApprovePress: function () {
            this._openApprovalDialog("approve");
        
            const oButtonStateModel = this.getView().getModel("buttonState");
            oButtonStateModel.setProperty("/isApproveEnabled", false);
            oButtonStateModel.setProperty("/isRejectEnabled", false);
            oButtonStateModel.setProperty("/isReviseEnabled", false);
        },

        onRejectPress: function () {
            this._openApprovalDialog("reject");

            // Disable the buttons after action
            const oButtonStateModel = this.getView().getModel("buttonState");
            oButtonStateModel.setProperty("/isApproveEnabled", false);
            oButtonStateModel.setProperty("/isRejectEnabled", false);
            oButtonStateModel.setProperty("/isReviseEnabled", false);
        },

        onRevisePress: function () {
            this._openApprovalDialog("revise");

            // Disable the buttons after action
            const oButtonStateModel = this.getView().getModel("buttonState");
            oButtonStateModel.setProperty("/isApproveEnabled", false);
            oButtonStateModel.setProperty("/isRejectEnabled", false);
            oButtonStateModel.setProperty("/isReviseEnabled", false);
        },

        _openApprovalDialog: function (sAction) {
            if (!this._oApprovalDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ApprovalDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oApprovalDialog = oDialog;
                    this.getView().addDependent(this._oApprovalDialog);
                    this._oApprovalDialog.data("action", sAction);
                    this._oApprovalDialog.open();
                }.bind(this)); 
            } else {
                this._oApprovalDialog.data("action", sAction);
                this._oApprovalDialog.open();
            }
        },

        _currentUser: function (sRequestId) {
            console.log("Current User Function - Request ID:", sRequestId);
        
            return new Promise((resolve, reject) => {
                this._oBusy.open();
        
                // Dynamically determine the OData model if _oSelectedModel is not set
                if (!this._oSelectedModel) {
                    console.warn("No OData model selected. Attempting to determine the model dynamically.");
                    const oMovementModel = this.getOwnerComponent().getModel();
                    const oPromotionModel = this.getOwnerComponent().getModel("Promotion");
                    const oDemotionModel = this.getOwnerComponent().getModel("Demotion");
                    const oAssignmentModel = this.getOwnerComponent().getModel("Assignment");
                    const oStatusChangeModel = this.getOwnerComponent().getModel("StatusChange");
                    const oActingModel = this.getOwnerComponent().getModel("Acting");
                            
                    if (oPromotionModel) {
                        this._oSelectedModel = oPromotionModel;
                        console.log("Promotion model selected dynamically.");
                    } else if (oMovementModel) {
                        this._oSelectedModel = oMovementModel;
                        console.log("Movement model selected dynamically.");
                    } else if (oDemotionModel) {
                        this._oSelectedModel = oDemotionModel;
                        console.log("Demotion model selected dynamically.");
                    } else if (oAssignmentModel) {
                        this._oSelectedModel = oAssignmentModel;
                        console.log("Assignment model selected dynamically.");
                    } else if (oStatusChangeModel) {
                        this._oSelectedModel = oStatusChangeModel;
                        console.log("StatusChange model selected dynamically.");
                    } else if (oActingModel) {
                        this._oSelectedModel = oActingModel;
                        console.log("Acting model selected dynamically.");
                    } else {
                        console.error("No OData models available.");
                        this._oBusy.close();
                        MessageBox.error("System error: No OData models available.");
                        reject(new Error("No OData models available."));
                        return;
                    }
                }
        
                if (!sRequestId || sRequestId === "undefined") {
                    console.error("Invalid Request ID:", sRequestId);
                    this._oBusy.close();
                    MessageBox.error("Invalid Request ID. Cannot proceed.");
                    reject(new Error("Invalid Request ID"));
                    return;
                }
        
                this._oSelectedModel.read("/EmployeeDetailSet", {
                    success: function (oEmployeeData) {
                        console.log("Current user data received:", oEmployeeData);
        
                        if (!oEmployeeData || !oEmployeeData.results || oEmployeeData.results.length === 0) {
                            this._oBusy.close();
                            MessageBox.error("No user data received from server.");
                            reject(new Error("No user data received from server."));
                            return;
                        }
        
                        const oCurrentUser = oEmployeeData.results[0];
                        this._sEmployeeId = oCurrentUser.EmployeeNumber;

                        const sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
                        this._oSelectedModel.read(sToApprovalPath, {
                            success: function (oApprovalData) {
                                console.log("toApproval data retrieved successfully:", oApprovalData);
        
                                if (!oApprovalData || !oApprovalData.results || oApprovalData.results.length === 0) {
                                    console.warn("No approval entries found for the given RequestId.");
                                    this._sUserStat = "UNKNOWN"; 
                                } else {
                                    const oMatchedApproval = oApprovalData.results.find(entry => entry.ApproverId === this._sEmployeeId);
        
                                    if (!oMatchedApproval) {
                                        console.warn("No matching approval entry found for the logged-in user.");
                                        this._sUserStat = "UNKNOWN";
                                    } else {
                                        this._sUserStat = oMatchedApproval.Stat; 
                                        this._oDetailApprovalModel.setProperty("/RequestId", sRequestId); 
                                    }
                                }
        
                                oCurrentUser.Stat = this._sUserStat; 
                                const oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
                                this.getView().setModel(oCurrentUserModel, "currentUser");
                                this._setVerificationAccess();
        
                                this._oBusy.close();
                                resolve(oCurrentUser);
                            }.bind(this),
                            error: function (oError) {
                                this._oBusy.close();
                                console.error("Error retrieving toApproval data:", oError);
                                MessageBox.error("Failed to load approval data.");
                                reject(oError);
                            }.bind(this)
                        });
                    }.bind(this),
                    error: function (oError) {
                        this._oBusy.close();
                        console.error("Error fetching current user data:", oError);
                        MessageBox.error(
                            "Failed to load user details: " +
                            (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
                        );
                        reject(oError);
                    }.bind(this)
                });
            });
        },

        // _currentUser: function (sRequestId) {
        //     console.log("Current User Function - Request ID:", sRequestId);
        
        //     return new Promise((resolve, reject) => {
        //         this._oBusy.open();
        
        //         if (!this._oSelectedModel) {
        //             console.error("No OData model selected for current user.");
        //             this._oBusy.close();
        //             MessageBox.error("System error: No OData model selected for current user.");
        //             reject(new Error("No OData model selected for current user."));
        //             return;
        //         }
        
        //         if (!sRequestId || sRequestId === "undefined") {
        //             console.error("Invalid Request ID:", sRequestId);
        //             this._oBusy.close();
        //             MessageBox.error("Invalid Request ID. Cannot proceed.");
        //             reject(new Error("Invalid Request ID"));
        //             return;
        //         }
        
        //         // Fetch the current user details from /EmployeeDetailSet
        //         this._oSelectedModel.read("/EmployeeDetailSet", {
        //             success: function (oEmployeeData) {
        //                 console.log("Current user data received:", oEmployeeData);
        
        //                 if (!oEmployeeData || !oEmployeeData.results || oEmployeeData.results.length === 0) {
        //                     this._oBusy.close();
        //                     MessageBox.error("No user data received from server.");
        //                     reject(new Error("No user data received from server."));
        //                     return;
        //                 }
        
        //                 const oCurrentUser = oEmployeeData.results[0];
        //                 this._sEmployeeId = oCurrentUser.EmployeeNumber;
        
        //                 // Fetch the approval data from /RequestSet('RequestId')/toApproval
        //                 const sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                 this._oSelectedModel.read(sToApprovalPath, {
        //                     success: function (oApprovalData) {
        //                         console.log("toApproval data retrieved successfully:", oApprovalData);
        
        //                         if (!oApprovalData || !oApprovalData.results || oApprovalData.results.length === 0) {
        //                             console.warn("No approval entries found for the given RequestId.");
        //                             this._sUserStat = "UNKNOWN"; // Default to UNKNOWN if no data is found
        //                         } else {
        //                             const oMatchedApproval = oApprovalData.results.find(entry => entry.ApproverId === this._sEmployeeId);
        
        //                             if (!oMatchedApproval) {
        //                                 console.warn("No matching approval entry found for the logged-in user.");
        //                                 this._sUserStat = "UNKNOWN"; // Default to UNKNOWN if no match is found
        //                             } else {
        //                                 this._sUserStat = oMatchedApproval.Stat; // Retrieve STAT field
        //                                 this._oDetailApprovalModel.setProperty("/RequestId", sRequestId); // Ensure RequestId is set
        //                             }
        //                         }
        
        //                         // Combine the STAT field with the current user data
        //                         oCurrentUser.Stat = this._sUserStat; // Add STAT to the current user object
        //                         const oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
        //                         this.getView().setModel(oCurrentUserModel, "currentUser");
        
        //                         this._oBusy.close();
        //                         resolve(oCurrentUser);
        //                     }.bind(this),
        //                     error: function (oError) {
        //                         this._oBusy.close();
        //                         console.error("Error retrieving toApproval data:", oError);
        //                         MessageBox.error("Failed to load approval data.");
        //                         reject(oError);
        //                     }.bind(this)
        //                 });
        //             }.bind(this),
        //             error: function (oError) {
        //                 this._oBusy.close();
        //                 console.error("Error fetching current user data:", oError);
        //                 MessageBox.error(
        //                     "Failed to load user details: " +
        //                     (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
        //                 );
        //                 reject(oError);
        //             }.bind(this)
        //         });
        //     });
        // },

        // _currentUser: function (sRequestId) {
        //     console.log("Current User Function - Request ID:", sRequestId);
        
        //     return new Promise((resolve, reject) => {
        //         this._oBusy.open();
        
        //         const oDataModel = this.getOwnerComponent().getModel();
        
        //         if (!oDataModel) {
        //             console.error("OData model not available");
        //             this._oBusy.close();
        //             MessageBox.error("System error: OData model not available");
        //             reject(new Error("OData model not available"));
        //             return;
        //         }
        
        //         if (!sRequestId || sRequestId === "undefined") {
        //             console.error("Invalid Request ID:", sRequestId);
        //             this._oBusy.close();
        //             MessageBox.error("Invalid Request ID. Cannot proceed.");
        //             reject(new Error("Invalid Request ID"));
        //             return;
        //         }
        
        //         // Fetch the current user details from /EmployeeDetailSet
        //         oDataModel.read("/EmployeeDetailSet", {
        //             success: function (oEmployeeData) {
        //                 console.log("Current user data received:", oEmployeeData);
        
        //                 if (!oEmployeeData || !oEmployeeData.results || oEmployeeData.results.length === 0) {
        //                     this._oBusy.close();
        //                     MessageBox.error("No user data received from server");
        //                     reject(new Error("No user data received from server"));
        //                     return;
        //                 }
        
        //                 const oCurrentUser = oEmployeeData.results[0];
        //                 this._sEmployeeId = oCurrentUser.EmployeeNumber;
        
        //                 // Fetch the approval data from /RequestSet('RequestId')/toApproval
        //                 const sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                 oDataModel.read(sToApprovalPath, {
        //                     success: function (oApprovalData) {
        //                         console.log("toApproval data retrieved successfully:", oApprovalData);
        
        //                         if (!oApprovalData || !oApprovalData.results || oApprovalData.results.length === 0) {
        //                             console.warn("No approval entries found for the given RequestId.");
        //                             this._sUserStat = "UNKNOWN"; // Default to UNKNOWN if no data is found
        //                         } else {
        //                             // Log the `toApproval` data for debugging
        //                             console.log("toApproval results:", oApprovalData.results);
        
        //                             // Find the entry where ApproverId matches the logged-in user's ID
        //                             const oMatchedApproval = oApprovalData.results.find(entry => entry.ApproverId === this._sEmployeeId);
        
        //                             if (!oMatchedApproval) {
        //                                 console.warn("No matching approval entry found for the logged-in user.");
        //                                 this._sUserStat = "UNKNOWN"; // Default to UNKNOWN if no match is found
        //                             } else {
        //                                 this._sUserStat = oMatchedApproval.Stat; // Retrieve STAT field
        //                                 this._oDetailApprovalModel.setProperty("/RequestId", sRequestId); // Ensure RequestId is set
        //                             }
        //                         }
        
        //                         // Combine the STAT field with the current user data
        //                         oCurrentUser.Stat = this._sUserStat; // Add STAT to the current user object
        //                         const oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
        //                         this.getView().setModel(oCurrentUserModel, "currentUser");
        
        //                         this._oBusy.close();
        //                         resolve(oCurrentUser);
        //                     }.bind(this),
        //                     error: function (oError) {
        //                         this._oBusy.close();
        //                         console.error("Error retrieving toApproval data:", oError);
        //                         MessageBox.error("Failed to load approval data.");
        //                         reject(oError);
        //                     }.bind(this)
        //                 });
        //             }.bind(this),
        //             error: function (oError) {
        //                 this._oBusy.close();
        //                 console.error("Error fetching current user data:", oError);
        //                 MessageBox.error(
        //                     "Failed to load user details: " +
        //                     (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
        //                 );
        //                 reject(oError);
        //             }.bind(this)
        //         });
        //     });
        // },

        // _currentUser: function (sRequestId) {
        //     console.log("Current User Function - Request ID:", sRequestId);
        
        //     return new Promise((resolve, reject) => {
        //         this._oBusy.open();
        
        //         const oDataModel = this.getOwnerComponent().getModel();
        
        //         if (!oDataModel) {
        //             console.error("OData model not available");
        //             this._oBusy.close();
        //             MessageBox.error("System error: OData model not available");
        //             reject(new Error("OData model not available"));
        //             return;
        //         }
        
        //         if (!sRequestId || sRequestId === "undefined") {
        //             console.error("Invalid Request ID:", sRequestId);
        //             this._oBusy.close();
        //             MessageBox.error("Invalid Request ID. Cannot proceed.");
        //             reject(new Error("Invalid Request ID"));
        //             return;
        //         }
        
        //         // Fetch the current user details from /EmployeeDetailSet
        //         oDataModel.read("/EmployeeDetailSet", {
        //             success: function (oEmployeeData) {
        //                 console.log("Current user data received:", oEmployeeData);
        
        //                 if (!oEmployeeData || !oEmployeeData.results || oEmployeeData.results.length === 0) {
        //                     this._oBusy.close();
        //                     MessageBox.error("No user data received from server");
        //                     reject(new Error("No user data received from server"));
        //                     return;
        //                 }
        
        //                 const oCurrentUser = oEmployeeData.results[0];
        //                 this._sEmployeeId = oCurrentUser.EmployeeNumber;
        
        //                 // Fetch the approval data from /RequestSet('RequestId')/toApproval
        //                 const sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                 oDataModel.read(sToApprovalPath, {
        //                     success: function (oApprovalData) {
        //                         console.log("toApproval data retrieved successfully:", oApprovalData);
        
        //                         if (!oApprovalData || !oApprovalData.results || oApprovalData.results.length === 0) {
        //                             console.warn("No approval entries found for the given RequestId.");
        //                             this._sUserStat = "UNKNOWN"; // Default to UNKNOWN if no data is found
        //                         } else {
        //                             // Log the `toApproval` data for debugging
        //                             console.log("toApproval results:", oApprovalData.results);
        
        //                             // Find the entry where ApproverId matches the logged-in user's ID
        //                             const oMatchedApproval = oApprovalData.results.find(entry => entry.ApproverId === this._sEmployeeId);
        
        //                             if (!oMatchedApproval) {
        //                                 console.warn("No matching approval entry found for the logged-in user.");
        //                                 this._sUserStat = "UNKNOWN"; // Default to UNKNOWN if no match is found
        //                             } else {
        //                                 this._sUserStat = oMatchedApproval.Stat; // Retrieve STAT field
        //                                 sRequestId = oMatchedApproval.RequestId; // Use RequestId from toApproval
        //                                 this._oDetailApprovalModel.setProperty("/RequestId", sRequestId); // Update the model
        //                             }
        //                         }
        
        //                         // Combine the STAT field with the current user data
        //                         oCurrentUser.Stat = this._sUserStat; // Add STAT to the current user object
        //                         const oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
        //                         this.getView().setModel(oCurrentUserModel, "currentUser");
        
        //                         this._oBusy.close();
        //                         resolve(oCurrentUser);
        //                     }.bind(this),
        //                     error: function (oError) {
        //                         this._oBusy.close();
        //                         console.error("Error retrieving toApproval data:", oError);
        //                         MessageBox.error("Failed to load approval data.");
        //                         reject(oError);
        //                     }.bind(this)
        //                 });
        //             }.bind(this),
        //             error: function (oError) {
        //                 this._oBusy.close();
        //                 console.error("Error fetching current user data:", oError);
        //                 MessageBox.error(
        //                     "Failed to load user details: " +
        //                     (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
        //                 );
        //                 reject(oError);
        //             }.bind(this)
        //         });
        //     });  
        // },

        loadApprovalHistoryWithRequestor: function (sRequestId) {
            if (!sRequestId) {
                MessageBox.error("No request ID found. Cannot fetch approval history.");
                return;
            }
        
            const aODataModels = [
                this.getOwnerComponent().getModel("Promotion"),
                this.getOwnerComponent().getModel(),
                this.getOwnerComponent().getModel("Demotion"),
                this.getOwnerComponent().getModel("Assignment"),
                this.getOwnerComponent().getModel("StatusChange"),
                this.getOwnerComponent().getModel("Acting")
            ];
        
            sap.ui.core.BusyIndicator.show(0);
        
            const fetchData = (oModel) => {
                return new Promise((resolve, reject) => {
                    if (!oModel) {
                        console.warn("OData model not available.");
                        resolve(null);
                        return;
                    }
        
                    const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
                    const sToApprovalPath = `${sRequestPath}/toApproval`;
        
                    oModel.read(sRequestPath, {
                        success: function (oRequestData) {
                            console.log("RequestSet data retrieved successfully:", oRequestData);
        
                            const sEmployeePath = `/EmployeeDetailSet('${oRequestData.PicNumber}')`;
                            oModel.read(sEmployeePath, {
                                success: function (oEmployeeData) {
                                    console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
                                    const sFormattedName = oEmployeeData.EmployeeName ? oEmployeeData.EmployeeName.FormattedName : "Unknown";
        
                                    const oRequestorEntry = {
                                        ApproverId: oRequestData.PicNumber, 
                                        ApproverName: sFormattedName, 
                                        ApprovalDate: oRequestData.CreatedOn,
                                        ApprovalTime: oRequestData.CreatedAt,
                                        Status: "Submitted",
                                        StatusText: "Submitted", 
                                        Notes: ""
                                    };
        
                                    oModel.read(sToApprovalPath, {
                                        success: function (oApprovalData) {
                                            console.log("toApproval data retrieved successfully:", oApprovalData);
        
                                            const aFilteredApprovalData = oApprovalData.results.filter(entry => {
                                                return entry.Status === "A" || entry.Status === "R" || entry.Status === "P";
                                            });
        
                                            const aApprovalHistory = [oRequestorEntry].concat(aFilteredApprovalData);
        
                                            resolve(aApprovalHistory);
                                        }.bind(this),
                                        error: function (oError) {
                                            console.error("Error retrieving approval history data:", oError);
                                            resolve(null); 
                                        }.bind(this)
                                    });
                                }.bind(this),
                                error: function (oError) {
                                    console.error("Error retrieving employee data:", oError);
                                    resolve(null); 
                                }.bind(this)
                            });
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error retrieving request data:", oError);
                            resolve(null); 
                        }.bind(this)
                    });
                });
            };
        
            const aPromises = aODataModels.map(fetchData);
        
            Promise.allSettled(aPromises)
                .then((aResults) => {
                    const aSuccessfulResults = aResults
                        .filter(result => result.status === "fulfilled" && result.value !== null)
                        .map(result => result.value);
        
                    if (aSuccessfulResults.length > 0) {
                        const aCombinedApprovalHistory = aSuccessfulResults.flat();
                        console.log("Combined approval history retrieved successfully:", aCombinedApprovalHistory);
        
                        const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: aCombinedApprovalHistory });
                        this.getView().byId("idApprTable").setModel(oApprovalHistoryModel, "appr");
                    } else {
                        MessageBox.error("Failed to load approval history from all services.");
                    }
                })
                .catch((oError) => {
                    console.error("Unexpected error:", oError);
                    MessageBox.error("An unexpected error occurred while loading approval history.");
                })
                .finally(() => {
                    sap.ui.core.BusyIndicator.hide();
                });
        },

        // loadApprovalHistoryWithRequestor: function (sRequestId) {
        //     const oModel = this.getView().getModel(); // Get the OData model
        //     const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
        //     const sToApprovalPath = `${sRequestPath}/toApproval`;
        
        //     sap.ui.core.BusyIndicator.show(0);
        
        //     oModel.read(sRequestPath, {
        //         success: function (oRequestData) {
        //             console.log("RequestSet data retrieved successfully:", oRequestData);

        //             const sEmployeePath = `/EmployeeDetailSet('${oRequestData.PicNumber}')`;
        //             oModel.read(sEmployeePath, {
        //                 success: function (oEmployeeData) {
        //                     console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
        //                     const sFormattedName = oEmployeeData.EmployeeName ? oEmployeeData.EmployeeName.FormattedName : "Unknown";
        
        //                     const oRequestorEntry = {
        //                         ApproverId: oRequestData.PicNumber, // Use PicNumber as ApproverId
        //                         ApproverName: sFormattedName, // Use FormattedName from EmployeeDetailSet
        //                         ApprovalDate: oRequestData.CreatedOn, // Use CreatedOn as ApprovalDate
        //                         ApprovalTime: oRequestData.CreatedAt, // Use CreatedAt as ApprovalTime
        //                         Status: "Submitted", // Default status
        //                         StatusText: "Submitted", // Default status text
        //                         Notes: ""
        //                     };
        
        //                     oModel.read(sToApprovalPath, {
        //                         success: function (oApprovalData) {
        //                             console.log("toApproval data retrieved successfully:", oApprovalData);
        
            
        //                             const sLoggedInEmployeeId = this._sEmployeeId;
        
        //                             const aFilteredApprovalData = oApprovalData.results.filter(entry => {
        //                                 return entry.Status === "A" || entry.Status === "R" || entry.Status === "P";
        //                             });
        
        //                             const aApprovalHistory = [oRequestorEntry].concat(aFilteredApprovalData);
        
        //                             const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: aApprovalHistory });
        
        //                             this.getView().byId("idApprTable").setModel(oApprovalHistoryModel, "appr");
        
        //                             sap.ui.core.BusyIndicator.hide();
        //                         }.bind(this),
        //                         error: function (oError) {
        //                             console.error("Error retrieving approval history data:", oError);
        //                             MessageBox.error("Failed to load approval history.");
        //                             sap.ui.core.BusyIndicator.hide();
        //                         }
        //                     });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error retrieving employee data:", oError);
        //                     MessageBox.error("Failed to load employee details.");
        //                     sap.ui.core.BusyIndicator.hide();
        //                 }
        //             });
        //         }.bind(this),
        //         error: function (oError) {
        //             console.error("Error retrieving request data:", oError);
        //             MessageBox.error("Failed to load request data.");
        //             sap.ui.core.BusyIndicator.hide();
        //         }
        //     });
        // },

        formatApprovalTime: function (sApprovalTime) {
            if (!sApprovalTime) {
                return ""; 
            }
        
            if (typeof sApprovalTime === "object" && sApprovalTime.ms !== undefined) {
                var iMilliseconds = sApprovalTime.ms; 
                var oDate = new Date(iMilliseconds); 
        
                var sHours = String(oDate.getUTCHours()).padStart(2, "0"); 
                var sMinutes = String(oDate.getUTCMinutes()).padStart(2, "0"); 
        
                return `${sHours}:${sMinutes}`;
            }
        
            return sApprovalTime;
        },

        _createApprovalDateTime: function () {
            var oDate = new Date();
        
            var sApprovalDate = oDate.toISOString().split(".")[0];
        
            
            var sApprovalTime = `PT${oDate.getHours()}H${oDate.getMinutes()}M${oDate.getSeconds()}S`;
        
            return {
                ApprovalDate: sApprovalDate,
                ApprovalTime: sApprovalTime
            };
        },

        onCheckboxSelect: function (oEvent) {
            const sSelectedId = oEvent.getSource().getId();
            const checkboxIds = ["hasilApproval1", "hasilApproval2", "hasilApproval3", "hasilApproval4", "hasilApproval5"];
        
            // Deselect all other checkboxes
            checkboxIds.forEach(id => {
                if (id !== sSelectedId) {
                    const oCheckbox = this.byId(id);
                    if (oCheckbox) {
                        oCheckbox.setSelected(false);
                    }
                }
            });
        },

        // onCheckboxSelect: function (oEvent) {
        //     const sSelectedId = oEvent.getSource().getId();
        //     const checkboxIds = ["hasilApproval1", "hasilApproval2", "hasilApproval3", "hasilApproval4", "hasilApproval5"];
        
        //     // Deselect all other checkboxes
        //     checkboxIds.forEach(id => {
        //         if (id !== sSelectedId) {
        //             const oCheckbox = this.byId(id);
        //             if (oCheckbox) {
        //                 oCheckbox.setSelected(false);
        //             }
        //         }
        //     });
        // },

        // onSubmitApproval: function () {
        //     var sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
        //     var sApprovalNotes = sap.ui.getCore().byId("approvalNotes").getValue(); // Notes from the dialog
        //     var sRequestId = this._oDetailApprovalModel.getProperty("/RequestId"); // Request ID
                    
        //     if (!sRequestId) {
        //         MessageBox.error("Request ID is missing. Cannot proceed with submission.");
        //         return;
        //     }
        
        //     // Retrieve the logged-in user's ID
        //     this._currentUser()
        //         .then((oCurrentUser) => {
        //             var sLoggedInUserId = oCurrentUser.EmployeeNumber;
        
        //             // Fetch data from /toApproval for the specific RequestId
        //             var oModel = this.getView().getModel();
        //             var sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
        //             oModel.read(sToApprovalPath, {
        //                 success: function (oData) {
        //                     console.log("toApproval data retrieved successfully:", oData);
        
        //                     // Find the entry where ApproverId matches the logged-in user's ID
        //                     var oMatchedApproval = oData.results.find(entry => entry.ApproverId === sLoggedInUserId);
        
        //                     if (!oMatchedApproval) {
        //                         MessageBox.error("You are not authorized to approve this request.");
        //                         return;
        //                     }
        
        //                     // Retrieve BI Checking notes from the form
        //                     const oBiCheckingNotesControl = this.byId("hasilBiCheckingApproval");
        //                     const sBiCheckingNotes = oBiCheckingNotesControl ? oBiCheckingNotesControl.getValue() : "";
        
        //                     if (!oBiCheckingNotesControl) {
        //                         console.error("Control 'hasilBiCheckingApproval' not found.");
        //                         MessageBox.error("BI Checking notes field is not available.");
        //                         return;
        //                     }

        //                     const oHasilApprovalModel = this.getView().getModel("hasilApproval");
        //                     if (!oHasilApprovalModel) {
        //                         console.error("hasilApproval model not found.");
        //                         return;
        //                     }
        //                     const oHasilApprovalData = oHasilApprovalModel.getData();
        //                     console.log("hasilApproval data:", oHasilApprovalData);

        //                     const sBiCheckingData = Object.keys(oHasilApprovalData)
        //                         .filter(key => oHasilApprovalData[key]) // Get keys where the value is true
        //                         .map(key => key.replace("hasilApproval", "")) // Extract the number from the key
        //                         .join(",");

        //                     if (!sBiCheckingData) {
        //                     console.error("No BI Checking data selected.");
        //                     MessageBox.error("Please select at least one BI Checking option.");
        //                     return;
        //                     }   

        //                     console.log("Selected BI Checking data:", sBiCheckingData);
        
        //                     var oDateTime = this._createApprovalDateTime();
        
        //                     // Prepare the payload for the update
        //                     var oApprovalData = {
        //                         SequenceNumber: oMatchedApproval.SequenceNumber,
        //                         Stat: oMatchedApproval.Stat,
        //                         ObjectType: oMatchedApproval.ObjectType,
        //                         ApproverId: oMatchedApproval.ApproverId,
        //                         Abbreviation: oMatchedApproval.Abbreviation,
        //                         Status: sAction === "approve" ? "A" : "R",
        //                         StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //                         ApprovalUser: sLoggedInUserId,
        //                         Notes: sApprovalNotes,
        //                         ApprovalDate: oDateTime.ApprovalDate,
        //                         ApprovalTime: oDateTime.ApprovalTime,
        //                         Zbichecking: sBiCheckingData,
        //                         Znotebicheck: sBiCheckingNotes 
        //                     };
        
        //                     console.log("Payload for update:", oApprovalData);
        
        //                     // Path to the specific RequestSet entity
        //                     var sPath = `/RequestSet(guid'${sRequestId}')`;
        
        //                     // Use the update method to modify the existing entity
        //                     oModel.update(sPath, oApprovalData, {
        //                         method: "MERGE", // Use MERGE for partial updates
        //                         success: function () {
        //                             MessageBox.success("Approval status and BI Checking data updated successfully.");
        
        //                             // Refresh the data for the current request
        //                             this._getDetailApprovalData(sRequestId);
        
        //                             // Refresh the approval history
        //                             this.loadApprovalHistoryWithRequestor(sRequestId);
        
        //                             // Keep the buttons disabled
        //                             const oButtonStateModel = this.getView().getModel("buttonState");
        //                             oButtonStateModel.setProperty("/isApproveEnabled", false);
        //                             oButtonStateModel.setProperty("/isRejectEnabled", false);
        
        //                             // Close the dialog
        //                             this._oApprovalDialog.close();
        //                         }.bind(this),
        //                         error: function (oError) {
        //                             console.error("Error updating approval status:", oError);
        //                             MessageBox.error("Failed to update approval status.");
        //                         }
        //                     });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error retrieving toApproval data:", oError);
        //                     MessageBox.error("Failed to load approval data.");
        //                 }
        //             });
        //         })
        //         .catch((error) => {
        //             console.error("Error retrieving current user:", error);
        //             MessageBox.error("Failed to retrieve logged-in user details.");
        //         });
        // },

        // onSubmitApproval: function () {
        //     var sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
        //     var sApprovalNotes = sap.ui.getCore().byId("approvalNotes").getValue(); // Notes from the dialog
        //     var sRequestId = this._oDetailApprovalModel.getProperty("/RequestId"); // Request ID

        //     if (!sRequestId) {
        //         MessageBox.error("Request ID is missing. Cannot proceed with submission.");
        //         return;
        //     }

        //     // Retrieve the logged-in user's ID
        //     this._currentUser()
        //         .then((oCurrentUser) => {
        //             var sLoggedInUserId = oCurrentUser.EmployeeNumber;

        //             // Check if the user is in the Approval role
        //             const oVerificationModel = this.getView().getModel("verificationModel");
        //             const isApprovalRole = !oVerificationModel.getProperty("/isBiCheckingEnabled");

        //             if (isApprovalRole) {
        //                 // Skip BI Checking logic for Approval role
        //                 console.log("Logged-in user is in Approval role. Skipping BI Checking logic.");

        //                 var oDateTime = this._createApprovalDateTime();

        //                 // Prepare the payload for Approval role
        //                 var oApprovalPayload = {
        //                     RequestId: sRequestId,
        //                     Status: sAction === "approve" ? "A" : "R",
        //                     StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //                     ApprovalUser: sLoggedInUserId,
        //                     ApprovalDate: oDateTime.ApprovalDate,
        //                     ApprovalTime: oDateTime.ApprovalTime,
        //                     Notes: sApprovalNotes
        //                 };

        //                 console.log("Payload for Approval role submission:", oApprovalPayload);

        //                 // Submit the payload
        //                 const oModel = this.getView().getModel();
        //                 const sPath = `/RequestSet(guid'${sRequestId}')`;

        //                 oModel.update(sPath, oApprovalPayload, {
        //                     method: "MERGE",
        //                     success: () => {
        //                         MessageBox.success("Approval data submitted successfully.");

        //                         // Refresh the data for the current request
        //                         this._getDetailApprovalData(sRequestId);

        //                         // Refresh the approval history
        //                         this.loadApprovalHistoryWithRequestor(sRequestId);

        //                         // Close the dialog
        //                         this._oApprovalDialog.close();
        //                     },
        //                     error: (oError) => {
        //                         console.error("Error submitting approval data:", oError);
        //                         MessageBox.error("Failed to submit approval data.");
        //                     }
        //                 });
        //             } else {
        //                 // BI Checking logic for other roles
        //                 console.log("Logged-in user is not in Approval role. Proceeding with BI Checking logic.");

        //                 // Retrieve BI Checking notes from the form
        //                 const oBiCheckingNotesControl = this.byId("hasilBiCheckingApproval");
        //                 const sBiCheckingNotes = oBiCheckingNotesControl ? oBiCheckingNotesControl.getValue() : "";

        //                 if (!oBiCheckingNotesControl) {
        //                     console.error("Control 'hasilBiCheckingApproval' not found.");
        //                     MessageBox.error("BI Checking notes field is not available.");
        //                     return;
        //                 }

        //                 // Retrieve the selected BI Checking checkbox
        //                 const checkboxIds = ["hasilMutation1", "hasilMutation2", "hasilMutation3", "hasilMutation4", "hasilMutation5"];
        //                 const oSelectedCheckbox = checkboxIds
        //                     .map(id => this.byId(id))
        //                     .find(checkbox => checkbox && checkbox.getSelected());

        //                 const sBiCheckingData = oSelectedCheckbox ? oSelectedCheckbox.getText() : "";

        //                 if (!sBiCheckingData) {
        //                     console.error("No BI Checking data selected.");
        //                     MessageBox.error("Please select one BI Checking option.");
        //                     return;
        //                 }

        //                 console.log("Selected BI Checking data:", sBiCheckingData);

        //                 var oDateTime = this._createApprovalDateTime();

        //                 // Prepare the payload for RequestSet update
        //                 var oRequestPayload = {
        //                     RequestId: sRequestId,
        //                     Status: sAction === "approve" ? "A" : "R",
        //                     StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //                     ApprovalUser: sLoggedInUserId,
        //                     ApprovalDate: oDateTime.ApprovalDate,
        //                     ApprovalTime: oDateTime.ApprovalTime,
        //                     Notes: sApprovalNotes,
        //                     Zbichecking: sBiCheckingData,
        //                     Znotebicheck: sBiCheckingNotes
        //                 };

        //                 console.log("Payload for RequestSet update:", oRequestPayload);

        //                 // Submit the payload
        //                 const oModel = this.getView().getModel();
        //                 const sPath = `/RequestSet(guid'${sRequestId}')`;

        //                 oModel.update(sPath, oRequestPayload, {
        //                     method: "MERGE",
        //                     success: () => {
        //                         MessageBox.success("Approval and BI Checking data submitted successfully.");

        //                         // Refresh the data for the current request
        //                         this._getDetailApprovalData(sRequestId);

        //                         // Refresh the approval history
        //                         this.loadApprovalHistoryWithRequestor(sRequestId);

        //                         // Close the dialog
        //                         this._oApprovalDialog.close();
        //                     },
        //                     error: (oError) => {
        //                         console.error("Error submitting approval and BI Checking data:", oError);
        //                         MessageBox.error("Failed to submit approval and BI Checking data.");
        //                     }
        //                 });
        //             }
        //         })
        //         .catch((error) => {
        //             console.error("Error retrieving current user:", error);
        //             MessageBox.error("Failed to retrieve logged-in user details.");
        //         });
        // },

        onSubmitApproval: function () {
            const sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
            const sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
            const sRequestId = this._oDetailApprovalModel.getProperty("/RequestId");
        
            if (!sRequestId) {
                console.error("Request ID is missing in detailApprovalModel.");
                MessageBox.error("Request ID is missing. Cannot proceed with submission.");
                return;
            }
        
            if (!this._oSelectedModel) {
                console.error("No OData model selected for submission.");
                MessageBox.error("System error: No OData model selected for submission.");
                return;
            }

            // Validate Disposisi input
            const oDisposisiModel = this.getView().getModel("disposisiApproval1");
            const iSelectedIndex = oDisposisiModel.getProperty("/selectedIndex");

            if (iSelectedIndex === -1) {
                MessageBox.error("Please select a value in the Disposisi panel before submitting.");
                return;
            }
        
            this._currentUser(sRequestId)
                .then((oCurrentUser) => {
                    const sLoggedInUserId = oCurrentUser.EmployeeNumber;
                    const sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
                    this._oSelectedModel.read(sToApprovalPath, {
                        success: (oData) => {
                            console.log("toApproval data retrieved successfully:", oData);
        
                            // Find the entry where ApproverId matches the logged-in user's ID
                            const oMatchedApproval = oData.results.find(entry => entry.ApproverId === sLoggedInUserId);
        
                            if (!oMatchedApproval) {
                                MessageBox.error("You are not authorized to approve this request.");
                                return;
                            }
        
                            if (oMatchedApproval.ApproverName !== oCurrentUser.EmployeeName.FormattedName) {
                                console.warn("ApproverName mismatch. Using fallback to correct it.");
                                oMatchedApproval.ApproverName = oCurrentUser.EmployeeName.FormattedName;
                            }
        
                            console.log("Matched approval entry:", oMatchedApproval);
        
                            const oDateTime = this._createApprovalDateTime();
        
                            // Common approval data for all users
                            const oApprovalData = {
                                SequenceNumber: oMatchedApproval.SequenceNumber,
                                Stat: oMatchedApproval.Stat,
                                ObjectType: oMatchedApproval.ObjectType,
                                ApproverId: oMatchedApproval.ApproverId,
                                Abbreviation: oMatchedApproval.Abbreviation,
                                Status: sAction === "approve" ? "A" : "R",
                                StatusText: sAction === "approve" ? "Approved" : "Rejected",
                                ApprovalUser: sLoggedInUserId,
                                Notes: sNotes,
                                ApprovalDate: oDateTime.ApprovalDate,
                                ApprovalTime: oDateTime.ApprovalTime
                            };
        
                            // Add additional data based on STAT and validate inputs
                            if (oMatchedApproval.Stat === "VT") {
                                const bVerifySelected = this.byId("verifyResultApproval").getSelected();
                                const sHasilAssesment = this.byId("assessmentResultApproval").getValue();
                                if (!bVerifySelected) {
                                    MessageBox.error("Please verify an assessment result before submitting.");
                                    return;
                                }
                                if (!sHasilAssesment) {
                                    MessageBox.error("HasilAssesment data is empty. Please fill it before submitting.");
                                    return;
                                }
                                oApprovalData.Zverify = bVerifySelected ? "1" : "";
                            } else if (oMatchedApproval.Stat === "VC") {
                                // const checkboxIds = ["hasilApproval1", "hasilApproval2", "hasilApproval3", "hasilApproval4", "hasilApproval5"];
                                // const aSelectedCheckboxes = checkboxIds
                                //     .map(id => this.byId(id))
                                //     .filter(checkbox => checkbox && checkbox.getSelected())
                                //     .map(checkbox => checkbox.getText());
                                // if (aSelectedCheckboxes.length === 0) {
                                //     MessageBox.error("Please select at least one BI Checking option before submitting.");
                                //     return;
                                // }
                                // oApprovalData.Zbichecking = aSelectedCheckboxes.join(",");
                                // oApprovalData.Znotebicheck = this.byId("hasilBiCheckingApproval").getValue();

                                const oRadioGroup = this.byId("hasilApprovalRadioGroup");
                                const iRadioIndex = oRadioGroup ? oRadioGroup.getSelectedIndex() : -1;
                                if (iRadioIndex === -1) {
                                    MessageBox.error("Please select one BI Checking option before submitting.");
                                    return;
                                }
                                // Value is 1-based (1 to 5)
                                oApprovalData.Zbichecking = (iRadioIndex + 1).toString();
                                oApprovalData.Znotebicheck = this.byId("hasilBiCheckingApproval").getValue();
        
                                // Validate mandatory document submission for VC
                                const oFileAttachmentModel = this.getView().getModel("fileAttachment");
                                const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
                                if (!aFiles || aFiles.length === 0) {
                                    MessageBox.error("Please upload at least one document before submitting.");
                                    return;
                                }
                            } else if (oMatchedApproval.Stat === "A5") {
                                const sRekomHcm = this.byId("rekomendasiHCMApproval").getValue();
                                // const sDisposisi = this.getView().getModel("disposisiApproval1").getProperty("/selectedIndex");
                                const sDispoNote = this.byId("dispoNoteApproval").getValue();
                                const sSalaryFnl = this.byId("gajiApproval").getValue() ? this.byId("gajiApproval").getValue().replace(/\D/g, '') : "0";

                                const oDisposisiRadioGroup = this.byId("disposisiApproval1");
                                const iDisposisiIndex = oDisposisiRadioGroup ? oDisposisiRadioGroup.getSelectedIndex() : -1;
        
                                if (!sRekomHcm || !sDispoNote || !sSalaryFnl || iDisposisiIndex === -1) {
                                    MessageBox.error("Please fill in all required fields in the Disposisi panel before submitting.");
                                    return;
                                }
        
                                oApprovalData.ZrekomHcm = sRekomHcm;
                                oApprovalData.Zdisposisi = (iDisposisiIndex + 1).toString();
                                oApprovalData.Znotedisp = sDispoNote;
                                oApprovalData.Zsalaryfnl = sSalaryFnl;
        
                                // Validate mandatory document submission for A5
                                const oFileAttachmentModel = this.getView().getModel("fileAttachment");
                                const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
                                if (!aFiles || aFiles.length === 0) {
                                    MessageBox.error("Please upload at least one document before submitting.");
                                    return;
                                }
                            }
        
                            console.log("Payload for submission:", oApprovalData);
        
                            // Submit the approval data
                            this._oSelectedModel.update(`/RequestSet(guid'${sRequestId}')`, oApprovalData, {
                                method: "MERGE",
                                success: () => {
                                    MessageBox.success("Approval submitted successfully.");
                                    this._oApprovalDialog.close();
                                    this._getDetailApprovalData(sRequestId);
                                    this.loadApprovalHistoryWithRequestor(sRequestId);
        
                                    // Submit files if required
                                    this.onSubmitFiles(sRequestId);
                                },
                                error: (oError) => {
                                    console.error("Error submitting approval:", oError);
                                    MessageBox.error("Failed to submit approval.");
                                }
                            });
                        },
                        error: (oError) => {
                            console.error("Error retrieving toApproval data:", oError);
                            MessageBox.error("Failed to load approval data.");
                        }
                    });
                })
                .catch((error) => {
                    console.error("Error retrieving current user:", error);
                    MessageBox.error("Failed to retrieve logged-in user details.");
                });
        },

        onZbicheckingSelect: function(oEvent) {
            var iSelectedIndex = oEvent.getParameter("selectedIndex");
            this.getView().getModel("detailApprovalModel").setProperty("/Zbichecking", (iSelectedIndex + 1).toString());
        },

        onDisposisiSelect: function(oEvent) {
            var iSelectedIndex = oEvent.getParameter("selectedIndex");
            // Store as 1-based (1 or 2)
            // this.getView().getModel("disposisiApproval1").setProperty("/selectedIndex", iSelectedIndex);
            // If you want to store as string "1" or "2" in detailApprovalModel:
            this.getView().getModel("detailApprovalModel").setProperty("/Zdisposisi", (iSelectedIndex + 1).toString());
        },

        // onSubmitApproval: function () {
        //     const sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
        //     const sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
        //     const sRequestId = this._oDetailApprovalModel.getProperty("/RequestId");
        
        //     if (!sRequestId) {
        //         console.error("Request ID is missing in detailApprovalModel.");
        //         MessageBox.error("Request ID is missing. Cannot proceed with submission.");
        //         return;
        //     }

        //     if (!this._oSelectedModel) {
        //         console.error("No OData model selected for submission.");
        //         MessageBox.error("System error: No OData model selected for submission.");
        //         return;
        //     }
        
        //     this._currentUser(sRequestId)
        //         .then((oCurrentUser) => {
        //             const sLoggedInUserId = oCurrentUser.EmployeeNumber;
        //             const sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
        //             this._oSelectedModel.read(sToApprovalPath, {
        //                 success: (oData) => {
        //                     console.log("toApproval data retrieved successfully:", oData);
        
        //                     // Find the entry where ApproverId matches the logged-in user's ID
        //                     const oMatchedApproval = oData.results.find(entry => entry.ApproverId === sLoggedInUserId);
        
        //                     if (!oMatchedApproval) {
        //                         MessageBox.error("You are not authorized to approve this request.");
        //                         return;
        //                     }

        //                     if (oMatchedApproval.ApproverName !== oCurrentUser.EmployeeName.FormattedName) {
        //                         console.warn("ApproverName mismatch. Using fallback to correct it.");
        //                         oMatchedApproval.ApproverName = oCurrentUser.EmployeeName.FormattedName;
        //                     }
            
        //                     console.log("Matched approval entry:", oMatchedApproval);
        
        //                     const oDateTime = this._createApprovalDateTime();
        
        //                     // Common approval data for all users
        //                     const oApprovalData = {
        //                         SequenceNumber: oMatchedApproval.SequenceNumber,
        //                         Stat: oMatchedApproval.Stat,
        //                         ObjectType: oMatchedApproval.ObjectType,
        //                         ApproverId: oMatchedApproval.ApproverId,
        //                         // ApproverName: oMatchedApproval.ApproverName,
        //                         Abbreviation: oMatchedApproval.Abbreviation,
        //                         Status: sAction === "approve" ? "A" : "R",
        //                         StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //                         ApprovalUser: sLoggedInUserId,
        //                         Notes: sNotes,
        //                         ApprovalDate: oDateTime.ApprovalDate,
        //                         ApprovalTime: oDateTime.ApprovalTime
        //                     };
        
        //                     // Add additional data based on STAT
        //                     if (oMatchedApproval.Stat === "VT") {
        //                         oApprovalData.Zverify = this.byId("verifyResultApproval").getSelected() ? "1" : "";
        //                         // oApprovalData.ZrekomHcm = this.byId("rekomendasiHCMMutation").getValue();
        //                     } else if (oMatchedApproval.Stat === "VC") {
        //                         const checkboxIds = ["hasilApproval1", "hasilApproval2", "hasilApproval3", "hasilApproval4", "hasilApproval5"];
        //                         oApprovalData.Zbichecking = checkboxIds
        //                             .map(id => this.byId(id))
        //                             .filter(checkbox => checkbox && checkbox.getSelected())
        //                             .map(checkbox => checkbox.getText())
        //                             .join(",");
        //                         oApprovalData.Znotebicheck = this.byId("hasilBiCheckingApproval").getValue();
        //                     } else if (oMatchedApproval.Stat === "A5") {
        //                         oApprovalData.ZrekomHcm = this.byId("rekomendasiHCMApproval").getValue();
        //                         oApprovalData.Zdisposisi = (parseInt(this.getView().getModel("disposisiApproval1").getProperty("/selectedIndex")) + 1).toString();
        //                         oApprovalData.Znotedisp = this.byId("dispoNoteApproval").getValue();
        //                         oApprovalData.Zsalaryfnl = this.byId("gajiApproval").getValue() ? this.byId("gajiApproval").getValue().replace(/\D/g, '') : "0";
        //                     }
        
        //                     console.log("Payload for submission:", oApprovalData);
        
        //                     // Submit the approval data
        //                     this._oSelectedModel.update(`/RequestSet(guid'${sRequestId}')`, oApprovalData, {
        //                         method: "MERGE",
        //                         success: () => {
        //                             MessageBox.success("Approval submitted successfully.");
        //                             this._oApprovalDialog.close();
        //                             this._getDetailApprovalData(sRequestId);
        //                             this.loadApprovalHistoryWithRequestor(sRequestId);
        
        //                             // Submit files if required
        //                             this.onSubmitFiles(sRequestId);
        //                         },
        //                         error: (oError) => {
        //                             console.error("Error submitting approval:", oError);
        //                             MessageBox.error("Failed to submit approval.");
        //                         }
        //                     });
        //                 },
        //                 error: (oError) => {
        //                     console.error("Error retrieving toApproval data:", oError);
        //                     MessageBox.error("Failed to load approval data.");
        //                 }
        //             });
        //         })
        //         .catch((error) => {
        //             console.error("Error retrieving current user:", error);
        //             MessageBox.error("Failed to retrieve logged-in user details.");
        //         });
        // },

        // onSubmitApproval: function () {
        //     const sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
        //     const sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
        //     const sRequestId = this._oDetailApprovalModel.getProperty("/RequestId");
        
        //     if (!sRequestId) {
        //         console.error("Request ID is missing in detailApprovalModel.");
        //         MessageBox.error("Request ID is missing. Cannot proceed with submission.");
        //         return;
        //     }
        
        //     this._currentUser(sRequestId)
        //         .then((oCurrentUser) => {
        //             const sLoggedInUserId = oCurrentUser.EmployeeNumber;
        
        //             // Fetch data from /toApproval for the specific RequestId
        //             const oModel = this.getView().getModel();
        //             const sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
        //             oModel.read(sToApprovalPath, {
        //                 success: (oData) => {
        //                     console.log("toApproval data retrieved successfully:", oData);
        
        //                     // Find the entry where ApproverId matches the logged-in user's ID
        //                     const oMatchedApproval = oData.results.find(entry => entry.ApproverId === sLoggedInUserId);
        
        //                     if (!oMatchedApproval) {
        //                         MessageBox.error("You are not authorized to approve this request.");
        //                         return;
        //                     }
        
        //                     const oDateTime = this._createApprovalDateTime();
        
        //                     // Common approval data for all users
        //                     const oApprovalData = {
        //                         SequenceNumber: oMatchedApproval.SequenceNumber,
        //                         Stat: oMatchedApproval.Stat,
        //                         ObjectType: oMatchedApproval.ObjectType,
        //                         ApproverId: oMatchedApproval.ApproverId,
        //                         Abbreviation: oMatchedApproval.Abbreviation,
        //                         Status: sAction === "approve" ? "A" : "R",
        //                         StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //                         ApprovalUser: sLoggedInUserId,
        //                         Notes: sNotes,
        //                         ApprovalDate: oDateTime.ApprovalDate,
        //                         ApprovalTime: oDateTime.ApprovalTime
        //                     };
        
        //                     // Add additional data based on STAT
        //                     if (oMatchedApproval.Stat === "VT") {
        //                         oApprovalData.Zverify = this.byId("verifyResultApproval").getSelected() ? "1" : "";
        //                         // oApprovalData.ZrekomHcm = this.byId("rekomendasiHCMMutation").getValue();
        //                     } else if (oMatchedApproval.Stat === "VC") {
        //                         const checkboxIds = ["hasilApproval1", "hasilApproval2", "hasilApproval3", "hasilApproval4", "hasilApproval5"];
        //                         oApprovalData.Zbichecking = checkboxIds
        //                             .map(id => this.byId(id))
        //                             .filter(checkbox => checkbox && checkbox.getSelected())
        //                             .map(checkbox => checkbox.getText())
        //                             .join(",");
        //                         oApprovalData.Znotebicheck = this.byId("hasilBiCheckingApproval").getValue();
        //                     } else if (oMatchedApproval.Stat === "A5") {
        //                         oApprovalData.ZrekomHcm = this.byId("rekomendasiHCMApproval").getValue();
        //                         oApprovalData.Zdisposisi = (parseInt(this.getView().getModel("disposisiApproval1").getProperty("/selectedIndex")) + 1).toString();
        //                         oApprovalData.Znotedisp = this.byId("dispoNoteApproval").getValue();
        //                         oApprovalData.Zsalaryfnl = this.byId("gajiApproval").getValue() ? this.byId("gajiApproval").getValue().replace(/\D/g, '') : "0";
        //                     }
        
        //                     console.log("Payload for submission:", oApprovalData);
        
        //                     // Submit the approval data
        //                     oModel.update(`/RequestSet(guid'${sRequestId}')`, oApprovalData, {
        //                         method: "MERGE",
        //                         success: () => {
        //                             MessageBox.success("Approval submitted successfully.");
        //                             this._oApprovalDialog.close();
        //                             this._getDetailApprovalData(sRequestId);
        //                             this.loadApprovalHistoryWithRequestor(sRequestId);
        
        //                             // Submit files if required
        //                             this.onSubmitFiles(sRequestId);
        //                         },
        //                         error: (oError) => {
        //                             console.error("Error submitting approval:", oError);
        //                             MessageBox.error("Failed to submit approval.");
        //                         }
        //                     });
        //                 },
        //                 error: (oError) => {
        //                     console.error("Error retrieving toApproval data:", oError);
        //                     MessageBox.error("Failed to load approval data.");
        //                 }
        //             });
        //         })
        //         .catch((error) => {
        //             console.error("Error retrieving current user:", error);
        //             MessageBox.error("Failed to retrieve logged-in user details.");
        //         });
        // },

        // onSubmitApproval: function () {
        //     const sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
        //     const sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
        //     const sRequestId = this._oDetailApprovalModel.getProperty("/RequestId");
        
        //     if (!sRequestId) {
        //         MessageBox.error("Request ID is missing. Cannot proceed with submission.");
        //         return;
        //     }
        
        //     this._currentUser()
        //         .then((oCurrentUser) => {
        //             const sLoggedInUserId = oCurrentUser.EmployeeNumber;
        //             const sUserStat = oCurrentUser.Stat;
        
        //             const oDateTime = this._createApprovalDateTime();
        
        //             // Common approval data for all users
        //             const oApprovalData = {
        //                 SequenceNumber: oMatchedApproval.SequenceNumber,
        //                 Stat: oMatchedApproval.Stat,
        //                 ObjectType: oMatchedApproval.ObjectType,
        //                 ApproverId: oMatchedApproval.ApproverId,
        //                 Abbreviation: oMatchedApproval.Abbreviation,
        //                 Status: sAction === "approve" ? "A" : "R",
        //                 StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //                 ApprovalUser: sLoggedInUserId,
        //                 Notes: sNotes,
        //                 ApprovalDate: oDateTime.ApprovalDate,
        //                 ApprovalTime: oDateTime.ApprovalTime
        //             };
        
        //             // Add additional data based on STAT
        //             if (sUserStat === "V1") {
        //                 oApprovalData.Zverify = this.byId("verifyResultMutation").getSelected() ? "1" : "";
        //                 oApprovalData.ZrekomHcm = this.byId("rekomendasiHCMMutation").getValue();
        //             } else if (sUserStat === "V2") {
        //                 const checkboxIds = ["hasilApproval1", "hasilApproval2", "hasilApproval3", "hasilApproval4", "hasilApproval5"];
        //                 oApprovalData.Zbichecking = checkboxIds
        //                     .map(id => this.byId(id))
        //                     .filter(checkbox => checkbox && checkbox.getSelected())
        //                     .map(checkbox => checkbox.getText())
        //                     .join(",");
        //                 oApprovalData.Znotebicheck = this.byId("hasilBiCheckingMutation").getValue();
        //             } else if (sUserStat === "A5") {
        //                 oApprovalData.Zdisposisi = (parseInt(this.getView().getModel("disposisiMutation").getProperty("/selectedIndex")) + 1).toString();
        //                 oApprovalData.Znotedisp = this.byId("dispoNoteMutation").getValue();
        //             }
        
        //             console.log("Payload for submission:", oApprovalData);
        
        //             // Submit the approval data
        //             const oModel = this.getView().getModel();
        //             oModel.update(`/RequestSet(guid'${sRequestId}')`, oApprovalData, {
        //                 method: "MERGE",
        //                 success: () => {
        //                     MessageBox.success("Approval submitted successfully.");
        
        //                     // Submit files if required
        //                     this.onSubmitFiles(sRequestId);
        //                 },
        //                 error: (oError) => {
        //                     console.error("Error submitting approval:", oError);
        //                     MessageBox.error("Failed to submit approval.");
        //                 }
        //             });
        //         })
        //         .catch((error) => {
        //             console.error("Error retrieving current user:", error);
        //             MessageBox.error("Failed to retrieve logged-in user details.");
        //         });
        // },

        // onSubmitApproval: function () {
        //     var sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
        //     var sNotes = sap.ui.getCore().byId("approvalNotes").getValue(); // Notes from the dialog
        //     var sRequestId = this._oDetailApprovalModel.getProperty("/RequestId"); // Request ID
        
        //     // Retrieve the logged-in user's ID
        //     this._currentUser()
        //         .then((oCurrentUser) => {
        //             var sLoggedInUserId = oCurrentUser.EmployeeNumber;
        
        //             // Fetch data from /toApproval for the specific RequestId
        //             var oModel = this.getView().getModel();
        //             var sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        
        //             oModel.read(sToApprovalPath, {
        //                 success: function (oData) {
        //                     console.log("toApproval data retrieved successfully:", oData);
        
        //                     // Find the entry where ApproverId matches the logged-in user's ID
        //                     var oMatchedApproval = oData.results.find(entry => entry.ApproverId === sLoggedInUserId);
        
        //                     if (!oMatchedApproval) {
        //                         MessageBox.error("You are not authorized to approve this request.");
        //                         return;
        //                     }

        //                     var oDateTime = this._createApprovalDateTime();
        
        //                     // Prepare the payload for the update
        //                     var oApprovalData = {
        //                         SequenceNumber: oMatchedApproval.SequenceNumber,
        //                         ObjectType: oMatchedApproval.ObjectType,
        //                         ApproverId: oMatchedApproval.ApproverId,
        //                         Abbreviation: oMatchedApproval.Abbreviation,
        //                         Status: sAction === "approve" ? "A" : "R", 
        //                         StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //                         ApprovalUser: sLoggedInUserId, 
        //                         Notes: sNotes, 
        //                         ApprovalDate: oDateTime.ApprovalDate, 
        //                         ApprovalTime: oDateTime.ApprovalTime
        //                     };
        
        //                     console.log("Payload for update:", oApprovalData);
        
        //                     // Path to the specific RequestSet entity
        //                     var sPath = `/RequestSet(guid'${sRequestId}')`;
        
        //                     // Use the update method to modify the existing entity
        //                     oModel.update(sPath, oApprovalData, {
        //                         method: "MERGE", // Use MERGE for partial updates
        //                         success: function () {
        //                             MessageBox.success("Approval status updated successfully");
        //                             this._oApprovalDialog.close();
        //                         }.bind(this),
        //                         error: function (oError) {
        //                             console.error("Error updating approval status:", oError);
        //                             MessageBox.error("Failed to update approval status");
        //                         }
        //                     });
        //                 }.bind(this),
        //                 error: function (oError) {
        //                     console.error("Error retrieving toApproval data:", oError);
        //                     MessageBox.error("Failed to load approval data");
        //                 }
        //             });
        //         })
        //         .catch((error) => {
        //             console.error("Error retrieving current user:", error);
        //             MessageBox.error("Failed to retrieve logged-in user details.");
        //         });
        // },

        // onSubmitFiles: function (sRequestId) {
        //     const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        
        //     if (!aFiles || aFiles.length === 0) {
        //         MessageBox.warning("No files to upload.");
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel();
        //     aFiles.forEach((oFile, index) => {
        //         const oPayload = {
        //             Reqid: sRequestId,
        //             Seqnr: index.toString(),
        //             FileName: oFile.FileName,
        //             FileType: oFile.FileType,
        //             FileSize: oFile.FileSize,
        //             Attachment: oFile.Attachment
        //         };
        
        //         oModel.create("/FileAttachmentSet", oPayload, {
        //             success: () => {
        //                 console.log("File uploaded successfully:", oFile.FileName);
        //             },
        //             error: (oError) => {
        //                 console.error("Error uploading file:", oError);
        //                 MessageBox.error("Failed to upload file: " + oFile.FileName);
        //             }
        //         });
        //     });
        // },

        onAfterItemAdded: function (oEvent) {
            const oItem = oEvent.getParameter("item");
            const oFile = oItem.getFileObject();
            const oModel = this.getView().getModel("fileAttachment");
            const aUploadedFiles = oModel ? oModel.getProperty("/results") : [];
        
            if (oFile) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const sBase64 = e.target.result.split(",")[1]; 
                    const sFileType = oFile.type || this._getMimeTypeFromExtension(oFile.name);
        
                    aUploadedFiles.push({
                        FileName: oFile.name,
                        FileType: sFileType,
                        FileSize: oFile.size.toString(),
                        Attachment: sBase64
                    });
        
                    if (!oModel) {
                        const oNewModel = new sap.ui.model.json.JSONModel({ results: aUploadedFiles });
                        this.getView().setModel(oNewModel, "fileAttachment");
                    } else {
                        oModel.setProperty("/results", aUploadedFiles);
                    }
                }.bind(this);
                reader.readAsDataURL(oFile);
            }
        
            oItem.setUploadState("Complete");
            oItem.setVisibleEdit(false);
        },
        
        _getMimeTypeFromExtension: function (sFileName) {
            const sExtension = sFileName.split(".").pop().toLowerCase();
            const oFileTypes = {
                "pdf": "application/pdf",
                "doc": "application/msword",
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "xls": "application/vnd.ms-excel",
                "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "png": "image/png",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "txt": "text/plain"
            };
            return oFileTypes[sExtension] || "application/octet-stream";
        },
        
        onAfterItemRemoved: function (oEvent) {
            const oItem = oEvent.getParameter("item");
            const sFileName = oItem.getFileName();
            const oModel = this.getView().getModel("fileAttachment");
            const aData = oModel.getProperty("/results");
        
            const aFilteredData = aData.filter(function (item) {
                return item.FileName !== sFileName;
            });
        
            oModel.setProperty("/results", aFilteredData);
        },

        onSubmitFiles: function (sRequestId) {
            if (!sRequestId) {
                MessageBox.error("No request ID found. Cannot upload files.");
                return;
            }
        
            if (!this._oSelectedModel) {
                console.error("No OData model selected for file upload.");
                MessageBox.error("System error: No OData model selected for file upload.");
                return;
            }
        
            const oFileAttachmentModel = this.getView().getModel("fileAttachment");
            const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        
            if (!aFiles || aFiles.length === 0) {
                return;
            }
        
            // Get the current user's STAT, PicName, and PicId
            const oCurrentUserModel = this.getView().getModel("currentUser");
            if (!oCurrentUserModel) {
                MessageBox.error("Current user data is not available. Cannot proceed with file upload.");
                return;
            }
        
            const sUserStat = oCurrentUserModel.getProperty("/Stat");
            const sPicName = oCurrentUserModel.getProperty("/EmployeeName/FormattedName");
            const sPicId = oCurrentUserModel.getProperty("/EmployeeNumber");
        
            // Determine TypeDoc and PicPosition based on STAT
            let sTypeDoc = "";
            let sPicPosition = "";
        
            switch (sUserStat) {
                case "VT":
                    sTypeDoc = "Hasil Asessment";
                    sPicPosition = "Talent Management";
                    break;
                case "VC":
                    sTypeDoc = "BI Checking";
                    sPicPosition = "Compensation & Benefit";
                    break;
                case "A5":
                    sTypeDoc = "Hasil Disposisi";
                    sPicPosition = "Data Management";
                    break;
                default:
                    MessageBox.error("Invalid STAT for the current user. Cannot proceed with file upload.");
                    return;
            }
        
            // Show busy indicator
            this._oBusy.open();
        
            // Fetch existing documents to calculate the next Seqnr
            const sPath = `/FileAttachmentSet`;
            const aFilters = [new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)];
        
            this._oSelectedModel.read(sPath, {
                filters: aFilters,
                success: function (oData) {
                    const aExistingFiles = oData.results || [];
                    let iNextSeqnr = aExistingFiles.length; // Start with the next available sequence number
                    const sBaseUrl = this._oSelectedModel.sServiceUrl;
                    // Function to process one file at a time
                    const processNextFile = (index) => {
                        if (index >= aFiles.length) {
                            // All files processed
                            this._oBusy.close();
                            MessageBox.success("All files uploaded successfully.", {
                                onClose: () => {
                                    console.log("File upload process completed.");
                                }
                            });
                            return;
                        }
        
                        const oFile = aFiles[index];
                        const aModelChecks = [
                            { name: "ZHR_PROMOTION_MAN_SRV_01", model: this.getOwnerComponent().getModel("Promotion") },
                            { name: "ZHR_MOVEMENT_MAN_SRV", model: this.getOwnerComponent().getModel() },
                            { name: "ZHR_DEMOTION_MAN_SRV_01", model: this.getOwnerComponent().getModel("Demotion") },
                            { name: "ZHR_ASSIGNMENT_MAN_SRV_01", model: this.getOwnerComponent().getModel("Assignment") },
                            { name: "ZHR_STAT_CHANGE_MAN_SRV_01", model: this.getOwnerComponent().getModel("StatusChange") },
                            { name: "ZHR_ACTING_MAN_SRV_01", model: this.getOwnerComponent().getModel("Acting") }
                        ];
                        
                        // Find the matched model dynamically
                        const oMatchedModel = aModelChecks.find(entry => entry.model === this._oSelectedModel);
                        const sServiceName = oMatchedModel ? oMatchedModel.name : "Unknown";
                        console.log("Selected model:", sServiceName);
        
                        // Prepare the payload for the current file
                        const oPayload = {
                            Reqid: sRequestId,
                            Seqnr: (iNextSeqnr++).toString(), // Increment sequence number for each file
                            FileName: oFile.FileName,
                            FileType: oFile.FileType,
                            FileSize: oFile.FileSize.toString(),
                            Attachment: oFile.Attachment,
                            CreatedOn: new Date().toISOString().split(".")[0],
                            TypeDoc: sTypeDoc,
                            PicPosition: sPicPosition,
                            PicName: sPicName,
                            PicId: sPicId,
                            Url: this.getOwnerComponent()
                            .getModel("i18n")
                            .getResourceBundle()
                            .getText("urlpath", [
                                sRequestId,
                                iNextSeqnr - 1, 
                                sServiceName,
                                'Mdt'
                            ])
                            // Url: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("urlpath", [sRequestId, index, 'Mdt'])
                        };
        
                        // Debugging output
                        console.log("Uploading file:", oFile.FileName);
                        console.log("Payload:", JSON.stringify(oPayload));
        
                        // Upload the current file
                        this._oSelectedModel.create("/FileAttachmentSet", oPayload, {
                            success: function () {
                                console.log("File uploaded successfully:", oFile.FileName);
                                // Process the next file
                                processNextFile(index + 1);
                            },
                            error: function (oError) {
                                this._oBusy.close();
        
                                // Log the full error response for debugging
                                console.error("Error response:", oError);
        
                                // Extract detailed error information
                                let errorDetails = "Unknown error";
                                try {
                                    if (oError.responseText) {
                                        const oErrorResponse = JSON.parse(oError.responseText);
                                        if (oErrorResponse.error && oErrorResponse.error.message) {
                                            errorDetails = oErrorResponse.error.message.value || oErrorResponse.error.message;
                                        } else if (oErrorResponse.error && oErrorResponse.error.innererror) {
                                            errorDetails = oErrorResponse.error.innererror.message;
                                        }
                                    }
                                } catch (e) {
                                    errorDetails = oError.message || "Parsing error response failed";
                                }
        
                                console.error("File upload error:", errorDetails);
                                MessageBox.error("Failed to upload file '" + oFile.FileName + "': " + errorDetails);
                            }.bind(this)
                        });
                    };
        
                    // Start processing files
                    processNextFile(0);
                }.bind(this),
                error: function (oError) {
                    this._oBusy.close();
                    console.error("Error fetching existing documents:", oError);
                    MessageBox.error("Failed to fetch existing documents. Cannot proceed with file upload.");
                }.bind(this)
            });
        },

        // onSubmitFiles: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot upload files.");
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel();
        //     const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        
        //     if (!aFiles || aFiles.length === 0) {
        //         return;
        //     }
        
        //     // Get the current user's STAT, PicName, and PicId
        //     const oCurrentUserModel = this.getView().getModel("currentUser");
        //     if (!oCurrentUserModel) {
        //         MessageBox.error("Current user data is not available. Cannot proceed with file upload.");
        //         return;
        //     }
        
        //     const sUserStat = oCurrentUserModel.getProperty("/Stat");
        //     const sPicName = oCurrentUserModel.getProperty("/EmployeeName/FormattedName");
        //     const sPicId = oCurrentUserModel.getProperty("/EmployeeNumber");
        
        //     // Determine TypeDoc and PicPosition based on STAT
        //     let sTypeDoc = "";
        //     let sPicPosition = "";
        
        //     switch (sUserStat) {
        //         case "VT":
        //             sTypeDoc = "Hasil Asessment";
        //             sPicPosition = "Talent Management";
        //             break;
        //         case "VC":
        //             sTypeDoc = "BI Checking";
        //             sPicPosition = "Compensation & Benefit";
        //             break;
        //         case "A5":
        //             sTypeDoc = "Hasil Disposisi";
        //             sPicPosition = "Data Management";
        //             break;
        //         default:
        //             MessageBox.error("Invalid STAT for the current user. Cannot proceed with file upload.");
        //             return;
        //     }
        
        //     // Show busy indicator
        //     this._oBusy.open();
        
        //     // Fetch existing documents to calculate the next Seqnr
        //     const sPath = `/FileAttachmentSet`;
        //     const aFilters = [new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)];
        
        //     oModel.read(sPath, {
        //         filters: aFilters,
        //         success: function (oData) {
        //             const aExistingFiles = oData.results || [];
        //             let iNextSeqnr = aExistingFiles.length; // Start with the next available sequence number
        
        //             // Function to process one file at a time
        //             const processNextFile = (index) => {
        //                 if (index >= aFiles.length) {
        //                     // All files processed
        //                     this._oBusy.close();
        //                     MessageBox.success("All files uploaded successfully.", {
        //                         onClose: () => {
        //                             console.log("File upload process completed.");
        //                         }
        //                     });
        //                     return;
        //                 }
        
        //                 const oFile = aFiles[index];
        
        //                 // Prepare the payload for the current file
        //                 const oPayload = {
        //                     Reqid: sRequestId,
        //                     Seqnr: (iNextSeqnr++).toString(), // Increment sequence number for each file
        //                     FileName: oFile.FileName,
        //                     FileType: oFile.FileType,
        //                     FileSize: oFile.FileSize.toString(),
        //                     Attachment: oFile.Attachment,
        //                     CreatedOn: new Date().toISOString().split(".")[0],
        //                     TypeDoc: sTypeDoc,
        //                     PicPosition: sPicPosition,
        //                     PicName: sPicName,
        //                     PicId: sPicId,
        //                     Url: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("urlpath", [sRequestId, index, 'Mdt'])
        //                 };
        
        //                 // Debugging output
        //                 console.log("Uploading file:", oFile.FileName);
        //                 console.log("Payload:", JSON.stringify(oPayload));
        
        //                 // Upload the current file
        //                 oModel.create("/FileAttachmentSet", oPayload, {
        //                     success: function () {
        //                         console.log("File uploaded successfully:", oFile.FileName);
        //                         // Process the next file
        //                         processNextFile(index + 1);
        //                     },
        //                     error: function (oError) {
        //                         this._oBusy.close();
        
        //                         // Log the full error response for debugging
        //                         console.error("Error response:", oError);
        
        //                         // Extract detailed error information
        //                         let errorDetails = "Unknown error";
        //                         try {
        //                             if (oError.responseText) {
        //                                 const oErrorResponse = JSON.parse(oError.responseText);
        //                                 if (oErrorResponse.error && oErrorResponse.error.message) {
        //                                     errorDetails = oErrorResponse.error.message.value || oErrorResponse.error.message;
        //                                 } else if (oErrorResponse.error && oErrorResponse.error.innererror) {
        //                                     errorDetails = oErrorResponse.error.innererror.message;
        //                                 }
        //                             }
        //                         } catch (e) {
        //                             errorDetails = oError.message || "Parsing error response failed";
        //                         }
        
        //                         console.error("File upload error:", errorDetails);
        //                         MessageBox.error("Failed to upload file '" + oFile.FileName + "': " + errorDetails);
        //                     }.bind(this)
        //                 });
        //             };
        
        //             // Start processing files
        //             processNextFile(0);
        //         }.bind(this),
        //         error: function (oError) {
        //             this._oBusy.close();
        //             console.error("Error fetching existing documents:", oError);
        //             MessageBox.error("Failed to fetch existing documents. Cannot proceed with file upload.");
        //         }.bind(this)
        //     });
        // },

        // onSubmitFiles: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot upload files.");
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel();
        //     const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        
        //     if (!aFiles || aFiles.length === 0) {
        //         MessageBox.warning("No files to upload. Do you want to continue with submission?", {
        //             actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        //             emphasizedAction: MessageBox.Action.YES,
        //             onClose: function (sAction) {
        //                 if (sAction === MessageBox.Action.YES) {
        //                     MessageBox.success("Submission completed without file uploads.");
        //                 }
        //             }.bind(this)
        //         });
        //         return;
        //     }
        
        //     // Get the current user's STAT, PicName, and PicId
        //     const oCurrentUserModel = this.getView().getModel("currentUser");
        //     if (!oCurrentUserModel) {
        //         MessageBox.error("Current user data is not available. Cannot proceed with file upload.");
        //         return;
        //     }
        
        //     const sUserStat = oCurrentUserModel.getProperty("/Stat");
        //     const sPicName = oCurrentUserModel.getProperty("/EmployeeName/FormattedName");
        //     const sPicId = oCurrentUserModel.getProperty("/EmployeeNumber");
        
        //     // Determine TypeDoc and PicPosition based on STAT
        //     let sTypeDoc = "";
        //     let sPicPosition = "";
        
        //     switch (sUserStat) {
        //         case "VT":
        //             sTypeDoc = "Hasil Asessment";
        //             sPicPosition = "Talent Management";
        //             break;
        //         case "VC":
        //             sTypeDoc = "BI Checking";
        //             sPicPosition = "Compensation & Benefit";
        //             break;
        //         case "A5":
        //             sTypeDoc = "Hasil Disposisi";
        //             sPicPosition = "Data Management";
        //             break;
        //         default:
        //             MessageBox.error("Invalid STAT for the current user. Cannot proceed with file upload.");
        //             return;
        //     }
        
        //     // Show busy indicator
        //     this._oBusy.open();
        
        //     // Function to process one file at a time
        //     const processNextFile = (index) => {
        //         if (index >= aFiles.length) {
        //             // All files processed
        //             this._oBusy.close();
        //             MessageBox.success("All files uploaded successfully.", {
        //                 onClose: () => {
        //                     console.log("File upload process completed.");
        //                 }
        //             });
        //             return;
        //         }
        
        //         const oFile = aFiles[index];
        
        //         // Prepare the payload for the current file
        //         const oPayload = {
        //             Reqid: sRequestId,
        //             Seqnr: index.toString(),
        //             FileName: oFile.FileName,
        //             FileType: oFile.FileType,
        //             FileSize: oFile.FileSize.toString(),
        //             Attachment: oFile.Attachment,
        //             CreatedOn: new Date().toISOString().split(".")[0],
        //             TypeDoc: sTypeDoc,
        //             PicPosition: sPicPosition,
        //             PicName: sPicName,
        //             PicId: sPicId,
        //             Url: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("urlpath", [sRequestId, index, 'Mdt'])
        //         };
        
        //         // Debugging output
        //         console.log("Uploading file:", oFile.FileName);
        //         console.log("Payload:", JSON.stringify(oPayload));
        
        //         // Upload the current file
        //         oModel.create("/FileAttachmentSet", oPayload, {
        //             success: function () {
        //                 console.log("File uploaded successfully:", oFile.FileName);
        //                 // Process the next file
        //                 processNextFile(index + 1);
        //             },
        //             error: function (oError) {
        //                 this._oBusy.close();
        
        //                 // Log the full error response for debugging
        //                 console.error("Error response:", oError);
        
        //                 // Extract detailed error information
        //                 let errorDetails = "Unknown error";
        //                 try {
        //                     if (oError.responseText) {
        //                         const oErrorResponse = JSON.parse(oError.responseText);
        //                         if (oErrorResponse.error && oErrorResponse.error.message) {
        //                             errorDetails = oErrorResponse.error.message.value || oErrorResponse.error.message;
        //                         } else if (oErrorResponse.error && oErrorResponse.error.innererror) {
        //                             errorDetails = oErrorResponse.error.innererror.message;
        //                         }
        //                     }
        //                 } catch (e) {
        //                     errorDetails = oError.message || "Parsing error response failed";
        //                 }
        
        //                 console.error("File upload error:", errorDetails);
        //                 MessageBox.error("Failed to upload file '" + oFile.FileName + "': " + errorDetails);
        //             }.bind(this)
        //         });
        //     };
        
        //     // Start processing files
        //     processNextFile(0);
        // },
        
        // onSubmitFiles: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot upload files.");
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel();
        //     const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        
        //     if (!aFiles || aFiles.length === 0) {
        //         MessageBox.warning("No files to upload. Do you want to continue with submission?", {
        //             actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        //             emphasizedAction: MessageBox.Action.YES,
        //             onClose: function (sAction) {
        //                 if (sAction === MessageBox.Action.YES) {
        //                     MessageBox.success("Submission completed without file uploads.");
        //                 }
        //             }.bind(this)
        //         });
        //         return;
        //     }
        
        //     // Show busy indicator
        //     this._oBusy.open();
        
        //     // Function to process one file at a time
        //     const processNextFile = (index) => {
        //         if (index >= aFiles.length) {
        //             // All files processed
        //             this._oBusy.close();
        //             MessageBox.success("All files uploaded successfully.", {
        //                 onClose: () => {
        //                     console.log("File upload process completed.");
        //                 }
        //             });
        //             return;
        //         }
        
        //         const oFile = aFiles[index];
        
        //         // Prepare the payload for the current file
        //         const oPayload = {
        //             Reqid: sRequestId,
        //             Seqnr: index.toString(),
        //             FileName: oFile.FileName,
        //             FileType: oFile.FileType,
        //             FileSize: oFile.FileSize.toString(),
        //             Attachment: oFile.Attachment,
        //             CreatedOn: new Date().toISOString().split(".")[0], // Example additional field
        //             TypeDoc: "BI Checking", // Example additional field
        //             PicPosition: "Compensation & Benefit", // Example additional field
        //             PicName: "Roy", // Example additional field
        //             PicId: "81000061" // Example additional field
        //         };
        
        //         // Debugging output
        //         console.log("Uploading file:", oFile.FileName);
        //         console.log("Payload:", JSON.stringify(oPayload));
        
        //         // Upload the current file
        //         oModel.create("/FileAttachmentSet", oPayload, {
        //             success: function () {
        //                 console.log("File uploaded successfully:", oFile.FileName);
        //                 // Process the next file
        //                 processNextFile(index + 1);
        //             },
        //             error: function (oError) {
        //                 this._oBusy.close();
        
        //                 // Log the full error response for debugging
        //                 console.error("Error response:", oError);
        
        //                 // Extract detailed error information
        //                 let errorDetails = "Unknown error";
        //                 try {
        //                     if (oError.responseText) {
        //                         const oErrorResponse = JSON.parse(oError.responseText);
        //                         if (oErrorResponse.error && oErrorResponse.error.message) {
        //                             errorDetails = oErrorResponse.error.message.value || oErrorResponse.error.message;
        //                         } else if (oErrorResponse.error && oErrorResponse.error.innererror) {
        //                             errorDetails = oErrorResponse.error.innererror.message;
        //                         }
        //                     }
        //                 } catch (e) {
        //                     errorDetails = oError.message || "Parsing error response failed";
        //                 }
        
        //                 console.error("File upload error:", errorDetails);
        //                 MessageBox.error("Failed to upload file '" + oFile.FileName + "': " + errorDetails);
        //             }.bind(this)
        //         });
        //     };
        
        //     // Start processing files
        //     processNextFile(0);
        // },

        onGajiApprovalLiveChange: function (oEvent) {
            // Get the new value from the input field
            const sNewValue = oEvent.getParameter("value");
        
            // Optionally, perform validation or formatting here
            if (isNaN(sNewValue.replace(/,/g, ''))) {
                sap.m.MessageToast.show("Please enter a valid number.");
                return;
            }
        
            // Update the model with the new value
            const oInput = oEvent.getSource();
            const oBindingContext = oInput.getBindingContext("detailApprovalModel");
            const sPath = oInput.getBinding("value").getPath();
        
            // Set the new value in the model
            oBindingContext.getModel().setProperty(sPath, sNewValue);
        },

        _setVerificationAccess: function () {
            const oCurrentUserModel = this.getView().getModel("currentUser");
            if (!oCurrentUserModel) {
                console.error("currentUser model not available");
                return;
            }
        
            const sLoggedInEmployeeNumber = oCurrentUserModel.getProperty("/EmployeeNumber");
            const sUserStat = oCurrentUserModel.getProperty("/Stat"); // Get STAT field
            console.log("Logged-in Employee Number:", sLoggedInEmployeeNumber, "STAT:", sUserStat);
        
            const oVerificationModel = this.getView().getModel("verificationModel");
            if (!oVerificationModel) {
                console.error("verificationModel not available");
                return;
            }
        
            // Set access based on STAT
            switch (sUserStat) {
                case "A1":
                case "A2":
                case "A3":
                case "A4":
                case "A6":
                case "A7":
                    oVerificationModel.setProperty("/isAssessmentEnabled", false);
                    oVerificationModel.setProperty("/isBiCheckingEnabled", false);
                    oVerificationModel.setProperty("/isDisposisiEnabled", false);
                    oVerificationModel.setProperty("/isSubmitVisible", true);
                    oVerificationModel.setProperty("/isDownloadEnabled", false);
                    oVerificationModel.setProperty("/isUploadVisible", false); // Disable upload for these roles
                    oVerificationModel.setProperty("/isSalaryFinalEditable", false);
                    console.log("Access set for Approver roles");
                    break;
        
                case "VT":
                    oVerificationModel.setProperty("/isAssessmentEnabled", true);
                    oVerificationModel.setProperty("/isBiCheckingEnabled", false);
                    oVerificationModel.setProperty("/isDisposisiEnabled", false);
                    oVerificationModel.setProperty("/isSubmitVisible", true);
                    oVerificationModel.setProperty("/isDownloadEnabled", false);
                    oVerificationModel.setProperty("/isUploadVisible", false); // Enable upload for VT
                    oVerificationModel.setProperty("/isSalaryFinalEditable", false);
                    console.log("Access set for Verificator 1 (Talent Management)");
                    break;
        
                case "VC":
                    oVerificationModel.setProperty("/isAssessmentEnabled", false);
                    oVerificationModel.setProperty("/isBiCheckingEnabled", true);
                    oVerificationModel.setProperty("/isDisposisiEnabled", false);
                    oVerificationModel.setProperty("/isSubmitVisible", true);
                    oVerificationModel.setProperty("/isDownloadEnabled", false);
                    oVerificationModel.setProperty("/isUploadVisible", true); // Enable upload for VC
                    oVerificationModel.setProperty("/isSalaryFinalEditable", false);
                    console.log("Access set for Verificator 2 (BI Checking)");
                    break;
        
                case "A5":
                    oVerificationModel.setProperty("/isAssessmentEnabled", false);
                    oVerificationModel.setProperty("/isBiCheckingEnabled", false);
                    oVerificationModel.setProperty("/isDisposisiEnabled", true);
                    oVerificationModel.setProperty("/isSubmitVisible", true);
                    oVerificationModel.setProperty("/isDownloadEnabled", true);
                    oVerificationModel.setProperty("/isUploadVisible", true); // Enable upload for A5
                    oVerificationModel.setProperty("/isSalaryFinalEditable", true);
                    console.log("Access set for Approver A5 (Disposisi)");
                    break;
        
                default:
                    oVerificationModel.setProperty("/isAssessmentEnabled", false);
                    oVerificationModel.setProperty("/isBiCheckingEnabled", false);
                    oVerificationModel.setProperty("/isDisposisiEnabled", false);
                    oVerificationModel.setProperty("/isSubmitVisible", false);
                    oVerificationModel.setProperty("/isDownloadEnabled", false);
                    oVerificationModel.setProperty("/isUploadVisible", false); 
                    oVerificationModel.setProperty("/isSalaryFinalEditable", false);
                    console.log("Access set for unknown role");
                    break;
            }

            console.log("isUploadVisible for VT:", oVerificationModel.getProperty("/isUploadVisible"));
        },

        onDownloadDisposisi: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("detailApprovalModel");
        
            if (!oContext) {
                sap.m.MessageToast.show("No context available for this document.");
                return;
            }
        
            const sEmpNo = oContext.getProperty("EmployeeNumber");
        
            if (!sEmpNo) {
                sap.m.MessageToast.show("Employee number is required to download the template.");
                return;
            }
        
            // Define the template name and construct the URL
            const sTemplateName = "Form Disposisi (template).xlsx";
            const sUrl = `/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV/TemplateCollection(EmployeeNumber='${sEmpNo}')/$value`;
        
            // Show busy indicator
            this._oBusy.open();
        
            // Fetch the template file
            fetch(sUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/octet-stream",
                    "Accept": "application/octet-stream"
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to download template. Status: ${response.status}`);
                    }
                    return response.blob();
                })
                .then(blob => {
                    // Create a link element to trigger the download
                    const oLink = document.createElement("a");
                    oLink.href = window.URL.createObjectURL(blob);
                    oLink.download = sTemplateName;
                    oLink.click();
        
                    // Clean up
                    window.URL.revokeObjectURL(oLink.href);
                    this._oBusy.close();
                })
                .catch(error => {
                    console.error("Error downloading template:", error);
                    sap.m.MessageBox.error("Failed to download the template. Please try again later.");
                    this._oBusy.close();
                });
        },

        // _setVerificationAccess: function () {
        //     const oCurrentUserModel = this.getView().getModel("currentUser");
        //     if (!oCurrentUserModel) {
        //         console.error("currentUser model not available");
        //         return;
        //     }
        
        //     const sLoggedInEmployeeNumber = oCurrentUserModel.getProperty("/EmployeeNumber");
        //     const sUserStat = oCurrentUserModel.getProperty("/Stat"); // Get STAT field
        //     console.log("Logged-in Employee Number:", sLoggedInEmployeeNumber, "STAT:", sUserStat);
        
        //     const oVerificationModel = this.getView().getModel("verificationModel");
        //     if (!oVerificationModel) {
        //         console.error("verificationModel not available");
        //         return;
        //     }
        
        //     // Set access based on STAT
        //     switch (sUserStat) {
        //         case "A1":
        //         case "A2":
        //         case "A3":
        //         case "A4":
        //         case "A6":
        //         case "A7":
        //             oVerificationModel.setProperty("/isAssessmentEnabled", false);
        //             oVerificationModel.setProperty("/isBiCheckingEnabled", false);
        //             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //             oVerificationModel.setProperty("/isSubmitVisible", true);
        //             console.log("Access set for Approver roles");
        //             break;
        
        //         case "VT":
        //             oVerificationModel.setProperty("/isAssessmentEnabled", true);
        //             oVerificationModel.setProperty("/isBiCheckingEnabled", false);
        //             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //             oVerificationModel.setProperty("/isSubmitVisible", true);
        //             console.log("Access set for Verificator 1 (Talent Management)");
        //             break;
        
        //         case "VC":
        //             oVerificationModel.setProperty("/isAssessmentEnabled", false);
        //             oVerificationModel.setProperty("/isBiCheckingEnabled", true);
        //             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //             oVerificationModel.setProperty("/isSubmitVisible", true);
        //             console.log("Access set for Verificator 2 (BI Checking)");
        //             break;
        
        //         case "A5":
        //             oVerificationModel.setProperty("/isAssessmentEnabled", false);
        //             oVerificationModel.setProperty("/isBiCheckingEnabled", false);
        //             oVerificationModel.setProperty("/isDisposisiEnabled", true);
        //             oVerificationModel.setProperty("/isSubmitVisible", true);
        //             console.log("Access set for Approver A5 (Disposisi)");
        //             break;
        
        //         default:
        //             oVerificationModel.setProperty("/isAssessmentEnabled", false);
        //             oVerificationModel.setProperty("/isBiCheckingEnabled", false);
        //             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //             oVerificationModel.setProperty("/isSubmitVisible", false);
        //             console.log("Access set for unknown role");
        //             break;
        //     }
        // },

        onCancelApproval: function () {
            // Close the approval dialog
            this._oApprovalDialog.close();
        
            // Reset the button states to enable them again
            const oButtonStateModel = this.getView().getModel("buttonState");
            if (oButtonStateModel) {
                oButtonStateModel.setProperty("/isApproveEnabled", true);
                oButtonStateModel.setProperty("/isRejectEnabled", true);
            }
        
            // Optionally refresh the view or reload data if needed
            const sRequestId = this._oDetailApprovalModel.getProperty("/RequestId");
            if (sRequestId) {
                this._getDetailApprovalData(sRequestId);
                this.loadApprovalHistoryWithRequestor(sRequestId);
            }
        },

        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("approval", {}, true);
            }
        }

    });
});