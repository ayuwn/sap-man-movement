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

    return BaseController.extend("bsim.hcmapp.man.movement.controller.DetailApprovalMov", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._oDetailApprovalMovModel = new JSONModel();
            this.getView().setModel(this._oDetailApprovalMovModel, "detailApprovalMovModel");
            // this.getView().byId("downloadDisposisiMov").bindElement({
            //     path: "/",
            //     model: "detailApprovalMovModel",
            // });

            const oButtonStateModel = new sap.ui.model.json.JSONModel({
                isApproveEnabled: false,
                isRejectEnabled: false,
                isReviseEnabled: false,
                isReviseVisible: true
            });
            this.getView().setModel(oButtonStateModel, "buttonState");

            this.getRouter().getRoute("detailapprovalmov").attachPatternMatched(this._onDetailApprovalMovRouteMatched, this);

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
                isUploadVisible: false,
                isVerifyMutation: false,
                isDisposisiVTEnabled: false,
                isDisposisiVCEnabled: false
            });
            this.getView().setModel(oVerificationModel, "verificationModel");

            let oDisposisiApprovalModel = new JSONModel({
                selectedIndex: 0
            });
            this._oView.setModel(oDisposisiApprovalModel, "disposisiApprovalMov1");

            const oViewModel = new JSONModel({
                isVerifyMutation: false
            });
            this.getView().setModel(oViewModel, "viewModel");

            this.getView().setModel(new sap.ui.model.json.JSONModel({
                isReviseVT: false,
                isReviseVC: false
            }), "reviseState");

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

        _onDetailApprovalMovRouteMatched: function (oEvent) {
            const sRequestId = oEvent.getParameter("arguments").RequestId;
            console.log("Route-matched Request ID:", sRequestId);

            if (!this._isValidGuid(sRequestId)) {
                console.error("Invalid Request ID format:", sRequestId);
                MessageBox.error("Invalid Request ID format");
                return;
            }

            console.log("Valid Request ID:", sRequestId);

            // Set the RequestId in the detailApprovalModel
            this._oDetailApprovalMovModel.setProperty("/RequestId", sRequestId);

            // Always use the default model
            this._oSelectedModel = this.getOwnerComponent().getModel();

            // Fetch detail data, approval history, and current user info
            this._getDetailApprovalData(sRequestId);
            this.loadApprovalHistoryWithRequestor(sRequestId);
            // this._currentUser(sRequestId)
            //     .then(() => {
            //         console.log("Verification access set successfully.");
            //     })
            //     .catch((error) => {
            //         console.error("Error setting verification access:", error);
            //     });

            // Clear upload set and file attachment model
            const oUploadSet = this.byId("idUploadSet");
            if (oUploadSet) {
                oUploadSet.removeAllItems();
            }
            const oFileAttachmentModel = this.getView().getModel("fileAttachment");
            if (oFileAttachmentModel) {
                oFileAttachmentModel.setProperty("/results", []);
            }

            // Update disposisi selection after loading detail data
            this._getDetailApprovalData(sRequestId).then(() => {
                this._updateDisposisiSelection();
            });

            this._currentUser(sRequestId)
            .then(() => {
                const oCurrentUserModel = this.getView().getModel("currentUser");
                const sEmployeeId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");
                const oButtonStateModel = this.getView().getModel("buttonState");

                // Read /toApproval for this request
                this._oSelectedModel.read(`/RequestSet(guid'${sRequestId}')/toApproval`, {
                    success: (oData) => {
                        // Find the approval entry for the current user
                        const oMatchedApproval = oData.results.find(entry => entry.ApproverId === sEmployeeId);

                        if (!oMatchedApproval) {
                            // No approval entry found for this user, disable all
                            oButtonStateModel.setProperty("/isApproveEnabled", false);
                            oButtonStateModel.setProperty("/isRejectEnabled", false);
                            oButtonStateModel.setProperty("/isReviseEnabled", false);
                            return;
                        }

                        const sStatus = oMatchedApproval.Status; // e.g. "S", "A", "R", "V"
                        const sStat = oMatchedApproval.Stat;     // e.g. "A1", "A2", etc.

                        console.log("DEBUG: Stat =", sStat, "Status =", sStatus);

                        // Disable buttons if already processed
                        if (sStatus === "V" || sStatus === "A" || sStatus === "R" || sStatus === "P") {
                            oButtonStateModel.setProperty("/isApproveEnabled", false);
                            oButtonStateModel.setProperty("/isRejectEnabled", false);
                            oButtonStateModel.setProperty("/isReviseEnabled", false);
                        } else {
                            oButtonStateModel.setProperty("/isApproveEnabled", true);
                            oButtonStateModel.setProperty("/isRejectEnabled", true);
                            oButtonStateModel.setProperty("/isReviseEnabled", true);
                        }
                    },
                    error: (oError) => {
                        // On error, disable all
                        oButtonStateModel.setProperty("/isApproveEnabled", false);
                        oButtonStateModel.setProperty("/isRejectEnabled", false);
                        oButtonStateModel.setProperty("/isReviseEnabled", false);
                    }
                });
            })
            .catch((error) => {
                console.error("Error setting verification access:", error);
            });

            // this._currentUser(sRequestId)
            // .then(() => {
            //     const oCurrentUserModel = this.getView().getModel("currentUser");
            //     const sStat = oCurrentUserModel && oCurrentUserModel.getProperty("/Stat");
            //     const sStatus = oCurrentUserModel && (oCurrentUserModel.getProperty("/Status") || oCurrentUserModel.getProperty("/StatusText"));
            //     const oButtonStateModel = this.getView().getModel("buttonState");

            //     console.log("DEBUG: sStat =", sStat, "sStatus =", sStatus);

            //     if (!sStat || !sStatus) {
            //         oButtonStateModel.setProperty("/isApproveEnabled", false);
            //         oButtonStateModel.setProperty("/isRejectEnabled", false);
            //         oButtonStateModel.setProperty("/isReviseEnabled", false);
            //         return;
            //     }
                
            //     if (
            //         (sStatus === "V" || sStatus === "A" || sStatus === "R")
            //     ) {
            //         oButtonStateModel.setProperty("/isApproveEnabled", false);
            //         oButtonStateModel.setProperty("/isRejectEnabled", false);
            //         oButtonStateModel.setProperty("/isReviseEnabled", false);
            //     } else {
            //         oButtonStateModel.setProperty("/isApproveEnabled", true);
            //         oButtonStateModel.setProperty("/isRejectEnabled", true);
            //         oButtonStateModel.setProperty("/isReviseEnabled", true);
            //     }
            // })
            // .catch((error) => {
            //     console.error("Error setting verification access:", error);
            // });

            // this._currentUser(sRequestId)
            // .then(() => {
            //     const oCurrentUserModel = this.getView().getModel("currentUser");
            //     const sStat = oCurrentUserModel && oCurrentUserModel.getProperty("/Stat");
            //     const sStatus = oCurrentUserModel && oCurrentUserModel.getProperty("/Status");
            //     const oButtonStateModel = this.getView().getModel("buttonState");
            //     if (
            //         (sStat === "A1" || sStat === "A2" || sStat === "A3" || sStat === "A4") &&
            //         (sStatus === "V" || sStatus === "A" || sStatus === "R")
            //     ) {
            //         oButtonStateModel.setProperty("/isApproveEnabled", false);
            //         oButtonStateModel.setProperty("/isRejectEnabled", false);
            //         oButtonStateModel.setProperty("/isReviseEnabled", false);
            //     } else if (sStat === "R" || sStat === "A" || sStat === "V") {
            //         oButtonStateModel.setProperty("/isApproveEnabled", false);
            //         oButtonStateModel.setProperty("/isRejectEnabled", false);
            //         oButtonStateModel.setProperty("/isReviseEnabled", false);
            //     } else {
            //         oButtonStateModel.setProperty("/isApproveEnabled", true);
            //         oButtonStateModel.setProperty("/isRejectEnabled", true);
            //         oButtonStateModel.setProperty("/isReviseEnabled", true);
            //     }
            // })
            // .catch((error) => {
            //     console.error("Error setting verification access:", error);
            // });
        },

        onAfterRendering: function () {
            var oDownloadBtn = this.getView().byId("downloadDisposisiMov");
            if (oDownloadBtn) {
                oDownloadBtn.bindElement({
                    path: "/",
                    model: "detailApprovalMovModel"
                });
            }
        },

        isVerifyMutation: function(oEvent) {
            var oViewModel = this.getView().getModel("viewModel");
            var bSelected = oEvent.getSource().getSelected();
            oViewModel.setProperty("/isVerifyMutation", bSelected);

            // If unticked and user is A5, clear the date fields in the model
            var oCurrentUserModel = this.getView().getModel("currentUser");
            if (oCurrentUserModel && oCurrentUserModel.getProperty("/Stat") === "A5" && !bSelected) {
                var oDetailModel = this.getView().getModel("detailApprovalMovModel");
                oDetailModel.setProperty("/TanggalJabatanAsl", null);
                oDetailModel.setProperty("/TanggalJabatanDest", null);
            }
        },

        onDownloadDisposisi: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("detailApprovalMovModel");
        
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

        _updateDisposisiSelection: function () {
            const sDisposisi = this._oDetailApprovalMovModel.getProperty("/Zdisposisi");
            const iSelectedIndex = sDisposisi === "1" ? 0 : 1; 
            this.getView().getModel("disposisiApprovalMov1").setProperty("/selectedIndex", iSelectedIndex);
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

        _isValidGuid: function (sGuid) {
            var guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            return guidRegex.test(sGuid);
        },

        _getDetailApprovalData: function (sRequestId) {
            if (!sRequestId || !this._isValidGuid(sRequestId)) {
                MessageBox.error("Invalid Request ID format. Cannot fetch details.");
                return;
            }

            const oModel = this.getOwnerComponent().getModel(); // Only use the default model
            this._oBusy.open();

            const sRequestPath = `/RequestSet(guid'${sRequestId}')`;

            return new Promise((resolve, reject) => {
                oModel.read(sRequestPath, {
                    success: function (oRequestData) {
                        console.log("RequestSet data retrieved successfully:", oRequestData);

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
                                        oModel.read(sAttachmentPath, {
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
                                                const oCombinedData = Object.assign({}, oEmployeeData, oRequestData, {
                                                    ApprovalHistory: oApprovalData.results,
                                                    Attachments: aAttachments
                                                });

                                                this._oDetailApprovalMovModel.setData(oCombinedData);
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
            })
            .catch((oError) => {
                MessageBox.error("An unexpected error occurred while loading request data.");
            })
            .finally(() => {
                this._oBusy.close();
            });
        },

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

        onReviseVTChange: function(oEvent) {
            var bSelected = oEvent.getSource().getSelected();
            this.getView().getModel("reviseState").setProperty("/isReviseVT", bSelected);
            this._updateA5ReviseState();
        },
        onReviseVCChange: function(oEvent) {
            var bSelected = oEvent.getSource().getSelected();
            this.getView().getModel("reviseState").setProperty("/isReviseVC", bSelected);
            this._updateA5ReviseState();
        },

        _updateA5ReviseState: function() {
            var oReviseState = this.getView().getModel("reviseState");
            var isReviseVT = oReviseState.getProperty("/isReviseVT");
            var isReviseVC = oReviseState.getProperty("/isReviseVC");
            var oButtonState = this.getView().getModel("buttonState");
            var oVerificationModel = this.getView().getModel("verificationModel");

            var oCurrentUserModel = this.getView().getModel("currentUser");
            var sStat = oCurrentUserModel && oCurrentUserModel.getProperty("/Stat");

            if (sStat === "A5") {
                if (isReviseVT || isReviseVC) {
                    // If any revise checked: disable approve/reject, enable revise
                    oButtonState.setProperty("/isApproveEnabled", false);
                    oButtonState.setProperty("/isRejectEnabled", false);
                    oButtonState.setProperty("/isReviseEnabled", true);
                    oVerificationModel.setProperty("/isDisposisiEnabled", false);
                    oVerificationModel.setProperty("/isSalaryFinalEditable", false);
                } else {
                    // If none checked: enable approve/reject, disable revise
                    oButtonState.setProperty("/isApproveEnabled", true);
                    oButtonState.setProperty("/isRejectEnabled", true);
                    oButtonState.setProperty("/isReviseEnabled", false);
                    oVerificationModel.setProperty("/isDisposisiEnabled", true);
                    
                    oVerificationModel.setProperty("/isSalaryFinalEditable", true);
                }
            }
        },

        _onValidateAssessment: function () {
            var oVerifyCheckbox = this.byId("verifyResultApprovalMov");
            return oVerifyCheckbox && oVerifyCheckbox.getSelected();
        },

        _validateVCSubmission: function () {
            var bValid = true;
            var aMessages = [];

            // Check BI Checking radio group selection
            var oRadioGroup = this.byId("hasilApprovalMovRadioGroup");
            var iRadioIndex = oRadioGroup ? oRadioGroup.getSelectedIndex() : -1;
            if (iRadioIndex === -1) {
                aMessages.push("Silakan pilih salah satu opsi BI Checking sebelum diajukan");
                bValid = false;
            }

            // Check at least one document uploaded
            var oFileAttachmentModel = this.getView().getModel("fileAttachment");
            var aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
            if (!aFiles || aFiles.length === 0) {
                aMessages.push("Silakan unggah minimal 1 dokumen sebelum diajukan");
                bValid = false;
            }

            // Show combined warning if needed
            if (!bValid) {
                sap.m.MessageBox.warning(aMessages.join("\n"));
            }

            return bValid;
        },

        _validateA5Submission: function() {
            var oReviseState = this.getView().getModel("reviseState");
            var isReviseVT = oReviseState.getProperty("/isReviseVT");
            var isReviseVC = oReviseState.getProperty("/isReviseVC");
            if (isReviseVT || isReviseVC) {
                // No validation needed if revising
                return true;
            }
            // Validate all required fields
            var sRekomHcm = this.byId("rekomendasiHCMApprovalMov").getValue();
            var oDisposisiRadioGroup = this.byId("disposisiApprovalMov1");
            var iDisposisiIndex = oDisposisiRadioGroup ? oDisposisiRadioGroup.getSelectedIndex() : -1;
            var sDispoNote = this.byId("dispoNoteApprovalMov").getValue();
            var sSalaryFnl = this.byId("gajiApprovalMov").getValue() ? this.byId("gajiApprovalMov").getValue().replace(/\D/g, '') : "0";
            var oFileAttachmentModel = this.getView().getModel("fileAttachment");
            var aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
            var aMessages = [];
            if (!sRekomHcm) aMessages.push("Silakan isi rekomendasi HCM sebelum diajukan.");
            if (iDisposisiIndex === -1) aMessages.push("Silakan pilih disposisi sebelum diajukan.");
            if (!sDispoNote) aMessages.push("Silakan isi catatan disposisi sebelum diajukan.");
            if (!sSalaryFnl || sSalaryFnl === "0") aMessages.push("Silakan isi gaji final sebelum diajukan.");
            if (!aFiles || aFiles.length === 0) aMessages.push("Silakan unggah minimal 1 dokumen sebelum diajukan.");
            if (aMessages.length > 0) {
                sap.m.MessageBox.warning(aMessages.join("\n"));
                return false;
            }
            return true;
        },

        onApprovePress: function () {
            var oCurrentUserModel = this.getView().getModel("currentUser");
            var sStat = oCurrentUserModel && oCurrentUserModel.getProperty("/Stat");

            if (sStat === "VT") {
                if (!this._onValidateAssessment()) {
                    MessageBox.warning("Silakan verifikasi assessment result sebelum diajukan.");
                    return;
                }
            }
            if (sStat === "VC") {
                if (!this._validateVCSubmission()) {
                    // _validateVCSubmission already shows the warning
                    return;
                }
            }
            if (sStat === "A5") {
                if (!this._validateA5Submission()) {
                    return;
                }
            }
            this._openApprovalDialog("approve");
        },

        // onApprovePress: function () {
        //     this._openApprovalDialog("approve");
        
        //     const oButtonStateModel = this.getView().getModel("buttonState");
        //     oButtonStateModel.setProperty("/isApproveEnabled", false);
        //     oButtonStateModel.setProperty("/isRejectEnabled", false);
        //     oButtonStateModel.setProperty("/isReviseEnabled", false);
        // },

        // onRejectPress: function () {
        //     this._openApprovalDialog("reject");

        //     // Disable the buttons after action
        //     const oButtonStateModel = this.getView().getModel("buttonState");
        //     oButtonStateModel.setProperty("/isApproveEnabled", false);
        //     oButtonStateModel.setProperty("/isRejectEnabled", false);
        //     oButtonStateModel.setProperty("/isReviseEnabled", false);
        // },

        onRejectPress: function () {
            var oCurrentUserModel = this.getView().getModel("currentUser");
            var sStat = oCurrentUserModel && oCurrentUserModel.getProperty("/Stat");

            // if (sStat === "VT") {
            //     if (!this._onValidateAssessment()) {
            //         MessageBox.warning("Silakan verifikasi assessment result sebelum diajukan.");
            //         return;
            //     }
            // }
            // if (sStat === "VC") {
            //     if (!this._validateVCSubmission()) {
            //         // _validateVCSubmission already shows the warning
            //         return;
            //     }
            // }
            // if (sStat === "A5") {
            //     if (!this._validateA5Submission()) {
            //         return;
            //     }
            // }
            this._openApprovalDialog("reject");
        },

        onRevisePress: function () {
            this._openApprovalDialog("revise");
            // this._disableApprovalButtons();
        },

        // onRevisePress: function () {
        //     this._openApprovalDialog("revise");

        //     // Disable the buttons after action
        //     const oButtonStateModel = this.getView().getModel("buttonState");
        //     oButtonStateModel.setProperty("/isApproveEnabled", false);
        //     oButtonStateModel.setProperty("/isRejectEnabled", false);
        //     oButtonStateModel.setProperty("/isReviseEnabled", false);
        // },

        _disableApprovalButtons: function () {
            const oButtonStateModel = this.getView().getModel("buttonState");
            oButtonStateModel.setProperty("/isApproveEnabled", false);
            oButtonStateModel.setProperty("/isRejectEnabled", false);
            oButtonStateModel.setProperty("/isReviseEnabled", false);
        },

        _openApprovalDialog: function (sAction) {
            if (this._oApprovalDialog) {
                this._oApprovalDialog.destroy(); // Destroy previous instance to avoid duplicate IDs
                this._oApprovalDialog = null;
            }
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
        
                const oDataModel = this.getOwnerComponent().getModel();
        
                if (!oDataModel) {
                    console.error("OData model not available");
                    this._oBusy.close();
                    MessageBox.error("System error: OData model not available");
                    reject(new Error("OData model not available"));
                    return;
                }
        
                if (!sRequestId || sRequestId === "undefined") {
                    console.error("Invalid Request ID:", sRequestId);
                    this._oBusy.close();
                    MessageBox.error("Invalid Request ID. Cannot proceed.");
                    reject(new Error("Invalid Request ID"));
                    return;
                }
        
                // Fetch the current user details from /EmployeeDetailSet
                oDataModel.read("/EmployeeDetailSet", {
                    success: function (oEmployeeData) {
                        console.log("Current user data received:", oEmployeeData);
        
                        if (!oEmployeeData || !oEmployeeData.results || oEmployeeData.results.length === 0) {
                            this._oBusy.close();
                            MessageBox.error("No user data received from server");
                            reject(new Error("No user data received from server"));
                            return;
                        }
        
                        const oCurrentUser = oEmployeeData.results[0];
                        this._sEmployeeId = oCurrentUser.EmployeeNumber;
        
                        // Fetch the approval data from /RequestSet('RequestId')/toApproval
                        const sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
                        oDataModel.read(sToApprovalPath, {
                            success: function (oApprovalData) {
                                console.log("toApproval data retrieved successfully:", oApprovalData);
        
                                if (!oApprovalData || !oApprovalData.results || oApprovalData.results.length === 0) {
                                    console.warn("No approval entries found for the given RequestId.");
                                    this._sUserStat = "UNKNOWN"; // Default to UNKNOWN if no data is found
                                } else {
                                    // Log the `toApproval` data for debugging
                                    console.log("toApproval results:", oApprovalData.results);
        
                                    // Find the entry where ApproverId matches the logged-in user's ID
                                    const oMatchedApproval = oApprovalData.results.find(entry => entry.ApproverId === this._sEmployeeId);
        
                                    if (!oMatchedApproval) {
                                        console.warn("No matching approval entry found for the logged-in user.");
                                        this._sUserStat = "UNKNOWN"; // Default to UNKNOWN if no match is found
                                    } else {
                                        this._sUserStat = oMatchedApproval.Stat; // Retrieve STAT field
                                        sRequestId = oMatchedApproval.RequestId; // Use RequestId from toApproval
                                        this._oDetailApprovalMovModel.setProperty("/RequestId", sRequestId); // Update the model
                                    }
                                }
        
                                // Combine the STAT field with the current user data
                                oCurrentUser.Stat = this._sUserStat; // Add STAT to the current user object
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

        loadApprovalHistoryWithRequestor: function (sRequestId) {
            const oModel = this.getView().getModel(); 
            const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
            const sToApprovalPath = `${sRequestPath}/toApproval`;
        
            sap.ui.core.BusyIndicator.show(0);
        
            oModel.read(sRequestPath, {
                success: function (oRequestData) {
                    console.log("RequestSet data retrieved successfully:", oRequestData);

                    const sEmployeePath = `/EmployeeDetailSet('${oRequestData.PicNumber}')`;
                    oModel.read(sEmployeePath, {
                        success: function (oEmployeeData) {
                            console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
                            const sFormattedName = oEmployeeData.EmployeeName ? oEmployeeData.EmployeeName.FormattedName : "Unknown";
        
                            const oRequestorEntry = {
                                ApproverId: oRequestData.PicNumber, // Use PicNumber as ApproverId
                                ApproverName: sFormattedName, // Use FormattedName from EmployeeDetailSet
                                ApprovalDate: oRequestData.CreatedOn, // Use CreatedOn as ApprovalDate
                                ApprovalTime: oRequestData.CreatedAt, // Use CreatedAt as ApprovalTime
                                Status: "Submitted", // Default status
                                StatusText: "Submitted", // Default status text
                                Notes: ""
                            };
        
                            oModel.read(sToApprovalPath, {
                                success: function (oApprovalData) {
                                    console.log("toApproval data retrieved successfully:", oApprovalData);
        
            
                                    const sLoggedInEmployeeId = this._sEmployeeId;
        
                                    const aFilteredApprovalData = oApprovalData.results.filter(entry => {
                                        return entry.Status === "A" || entry.Status === "R" || entry.Status === "P" || entry.Status === "V";
                                    });
        
                                    const aApprovalHistory = [oRequestorEntry].concat(aFilteredApprovalData);
        
                                    const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: aApprovalHistory });
        
                                    // this.getView().byId("idApprTable");
                                    // if (oApprTable) {
                                    //     oApprTable.setModel(oApprovalHistoryModel, "appr");
                                    // } else {
                                    //     console.warn("Approval table (idApprTable) not found in the view.");
                                    // }
                                    this.getView().setModel(oApprovalHistoryModel, "appr");
        
                                    sap.ui.core.BusyIndicator.hide();
                                }.bind(this),
                                error: function (oError) {
                                    console.error("Error retrieving approval history data:", oError);
                                    MessageBox.error("Failed to load approval history.");
                                    sap.ui.core.BusyIndicator.hide();
                                }
                            });
                        }.bind(this),
                        error: function (oError) {
                            console.error("Error retrieving employee data:", oError);
                            MessageBox.error("Failed to load employee details.");
                            sap.ui.core.BusyIndicator.hide();
                        }
                    });
                }.bind(this),
                error: function (oError) {
                    console.error("Error retrieving request data:", oError);
                    MessageBox.error("Failed to load request data.");
                    sap.ui.core.BusyIndicator.hide();
                }
            });
        },

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

        onSubmitApproval: function () {
            const sAction = this._oApprovalDialog.data("action"); 
            const sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
            const sRequestId = this._oDetailApprovalMovModel.getProperty("/RequestId");
        
            if (!sRequestId) {
                console.error("Request ID is missing in detailApprovalModel.");
                MessageBox.error("Request ID is missing. Cannot proceed with submission.");
                return;
            }

            // Validate Disposisi input
            const oDisposisiModel = this.getView().getModel("disposisiApprovalMov1");
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
                            // const oApprovalData = {
                            //     SequenceNumber: oMatchedApproval.SequenceNumber,
                            //     Stat: oMatchedApproval.Stat,
                            //     ObjectType: oMatchedApproval.ObjectType,
                            //     ApproverId: oMatchedApproval.ApproverId,
                            //     Abbreviation: oMatchedApproval.Abbreviation,
                            //     Status: sAction === "approve" ? "A" : "R",
                            //     StatusText: sAction === "approve" ? "Approved" : "Rejected",
                            //     ApprovalUser: sLoggedInUserId,
                            //     Notes: sNotes,
                            //     ApprovalDate: oDateTime.ApprovalDate,
                            //     ApprovalTime: oDateTime.ApprovalTime
                            // };

                            const oApprovalData = {
                                SequenceNumber: oMatchedApproval.SequenceNumber,
                                Stat: oMatchedApproval.Stat,
                                ObjectType: oMatchedApproval.ObjectType,
                                ApproverId: oMatchedApproval.ApproverId,
                                Abbreviation: oMatchedApproval.Abbreviation,
                                Status: sAction === "approve" ? "A" : (sAction === "reject" ? "R" : "V"),
                                StatusText: sAction === "approve" ? "Approved" : (sAction === "reject" ? "Rejected" : "Revise"),
                                ApprovalUser: sLoggedInUserId,
                                Notes: sNotes,
                                ApprovalDate: oDateTime.ApprovalDate,
                                ApprovalTime: oDateTime.ApprovalTime,
                            };
        
                            // Add additional data based on STAT and validate inputs
                            if (oMatchedApproval.Stat === "VT") {
                                const bVerifySelected = this.byId("verifyResultApprovalMov").getSelected();
                                const sHasilAssesment = this.byId("assessmentResultApprovalMov").getValue();
                                // if (!bVerifySelected) {
                                //     MessageBox.error("Please verify an assessment result before submitting.");
                                //     return;
                                // }
                                // if (!sHasilAssesment) {
                                //     MessageBox.error("HasilAssesment data is empty. Please fill it before submitting.");
                                //     return;
                                // }
                                oApprovalData.Zverify = bVerifySelected ? "1" : "";
                            } else if (oMatchedApproval.Stat === "VC") {
                                if (!this._validateVCSubmission()) {
                                    return;
                                }
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

                                const oRadioGroup = this.byId("hasilApprovalMovRadioGroup");
                                const iRadioIndex = oRadioGroup ? oRadioGroup.getSelectedIndex() : -1;
                                // if (iRadioIndex === -1) {
                                //     MessageBox.error("Please select one BI Checking option before submitting.");
                                //     return;
                                // }
                                // Value is 1-based (1 to 5)
                                oApprovalData.Zbichecking = (iRadioIndex + 1).toString();
                                oApprovalData.Znotebicheck = this.byId("hasilBiCheckingApprovalMov").getValue();
        
                                // Validate mandatory document submission for VC
                                const oFileAttachmentModel = this.getView().getModel("fileAttachment");
                                const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
                                // if (!aFiles || aFiles.length === 0) {
                                //     MessageBox.error("Please upload at least one document before submitting.");
                                //     return;
                                // }
                            } else if (oMatchedApproval.Stat === "A5") {
                                const sRekomHcm = this.byId("rekomendasiHCMApprovalMov").getValue();
                                // const sDisposisi = this.getView().getModel("disposisiApproval1").getProperty("/selectedIndex");
                                const sDispoNote = this.byId("dispoNoteApprovalMov").getValue();
                                const sSalaryFnl = this.byId("gajiApprovalMov").getValue() ? this.byId("gajiApprovalMov").getValue().replace(/\D/g, '') : "0";

                                const oDisposisiRadioGroup = this.byId("disposisiApprovalMov1");
                                const iDisposisiIndex = oDisposisiRadioGroup ? oDisposisiRadioGroup.getSelectedIndex() : -1;
        
                                // if (!sRekomHcm || !sDispoNote || !sSalaryFnl || iDisposisiIndex === -1) {
                                //     MessageBox.error("Please fill in all required fields in the Disposisi panel before submitting.");
                                //     return;
                                // }

                                const bRevisiTalent = this.byId("revisiVTApprovalMov").getSelected();
                                oApprovalData.RevisiTalent = bRevisiTalent ? "1" : "";

                                const bRevisiCombine = this.byId("reviseVCApprovalMov").getSelected();
                                oApprovalData.RevisiCombine = bRevisiCombine ? "1" : "";
        
                                oApprovalData.ZrekomHcm = sRekomHcm;
                                oApprovalData.Zdisposisi = (iDisposisiIndex + 1).toString();
                                oApprovalData.Znotedisp = sDispoNote;
                                oApprovalData.Zsalaryfnl = sSalaryFnl;

                                // Remove date values if verifyMov is not ticked
                                // var bVerifyMutation = this.getView().getModel("viewModel").getProperty("/isVerifyMutation");
                                // if (!bVerifyMutation) {
                                //     delete oApprovalData.TanggalJabatanAsl;
                                //     delete oApprovalData.TanggalJabatanDest;
                                //     oApprovalData.MutasiSkala = "0";
                                // } else {
                                //     oApprovalData.MutasiSkala = "1";
                                // }
        
                                // Validate mandatory document submission for A5
                                const oFileAttachmentModel = this.getView().getModel("fileAttachment");
                                const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
                                // if (!aFiles || aFiles.length === 0) {
                                //     MessageBox.error("Please upload at least one document before submitting.");
                                //     return;
                                // }
                            }
        
                            console.log("Payload for submission:", oApprovalData);
        
                            // Submit the approval data
                            this._oSelectedModel.update(`/RequestSet(guid'${sRequestId}')`, oApprovalData, {
                                method: "MERGE",
                                success: () => {
                                    this._disableApprovalButtons();
                                    
                                    MessageBox.success("Approval submitted successfully.", {
                                        onClose: () => {
                                            this._oApprovalDialog.close();
                                            // Optionally refresh data if you want before navigation
                                            // this._getDetailApprovalData(sRequestId);
                                            // this.loadApprovalHistoryWithRequestor(sRequestId);
                                            // this.onSubmitFiles(sRequestId);

                                            // Navigate to approval list view
                                            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                                            oRouter.navTo("approval", {}, true);
                                        }
                                    });
                                    // MessageBox.success("Approval submitted successfully.");
                                    // this._oApprovalDialog.close();
                                    // this._getDetailApprovalData(sRequestId);
                                    // this.loadApprovalHistoryWithRequestor(sRequestId);
        
                                    // // Submit files if required
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
            this.getView().getModel("detailApprovalMovModel").setProperty("/Zbichecking", (iSelectedIndex + 1).toString());
        },

        onDisposisiSelect: function(oEvent) {
            var iSelectedIndex = oEvent.getParameter("selectedIndex");
            // Store as 1-based (1 or 2)
            // this.getView().getModel("disposisiApproval1").setProperty("/selectedIndex", iSelectedIndex);
            // If you want to store as string "1" or "2" in detailApprovalModel:
            this.getView().getModel("detailApprovalMovModel").setProperty("/Zdisposisi", (iSelectedIndex + 1).toString());
            var oButtonStateModel = this.getView().getModel("buttonState");
            if (iSelectedIndex === 1) { // "Tidak Direkomendasikan" selected (index 1)
                oButtonStateModel.setProperty("/isApproveEnabled", false);
                oButtonStateModel.setProperty("/isReviseEnabled", false);
                oButtonStateModel.setProperty("/isRejectEnabled", true);
            } else {
                oButtonStateModel.setProperty("/isApproveEnabled", true);
                oButtonStateModel.setProperty("/isReviseEnabled", true);
                oButtonStateModel.setProperty("/isRejectEnabled", true);
            }
        },

        onAfterItemAdded: function (oEvent) {
            const oItem = oEvent.getParameter("item");
            const oFile = oItem.getFileObject();

            // Restrict to PDF only and max 5 MB
            const maxSize = 5 * 1024 * 1024; // 5 MB in bytes
            const allowedType = "application/pdf";
            const allowedExt = "pdf";

            if (oFile) {
                // Check file type and extension
                const fileType = oFile.type || this._getMimeTypeFromExtension(oFile.name);
                const fileExt = oFile.name.split('.').pop().toLowerCase();

                if (fileType !== allowedType || fileExt !== allowedExt) {
                    MessageBox.error("Only PDF files are allowed.");
                    oItem.setUploadState("Error");
                    oItem.setVisibleEdit(false);
                    return;
                }

                // Check file size
                if (oFile.size > maxSize) {
                    MessageBox.error("Maximum file size is 5 MB.");
                    oItem.setUploadState("Error");
                    oItem.setVisibleEdit(false);
                    return;
                }

            const oModel = this.getView().getModel("fileAttachment");
            const aUploadedFiles = oModel ? oModel.getProperty("/results") : [];
        
            if (oFile) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const sBase64 = e.target.result.split(",")[1]; 
                    // const sFileType = oFile.type || this._getMimeTypeFromExtension(oFile.name);
        
                    aUploadedFiles.push({
                        FileName: oFile.name,
                        FileType: fileType,
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
            }
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

            // Always use the default model
            const oModel = this.getOwnerComponent().getModel();

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

            oModel.read(sPath, {
                filters: aFilters,
                success: function (oData) {
                    const aExistingFiles = oData.results || [];
                    let iNextSeqnr = aExistingFiles.length; // Start with the next available sequence number

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
                            Url: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("urlpath", [
                                sRequestId,
                                iNextSeqnr - 1,
                                "ZHR_MOVEMENT_MAN_SRV",
                                "Mdt"
                            ])
                        };

                        // Debugging output
                        console.log("Uploading file:", oFile.FileName);
                        console.log("Payload:", JSON.stringify(oPayload));

                        // Upload the current file
                        oModel.create("/FileAttachmentSet", oPayload, {
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
                    oVerificationModel.setProperty("/isDisposisiVTEnabled", false);
                    oVerificationModel.setProperty("/isDisposisiVCEnabled", false);
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
                    oVerificationModel.setProperty("/isDisposisiVTEnabled", false);
                    oVerificationModel.setProperty("/isDisposisiVCEnabled", false);
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
                    oVerificationModel.setProperty("/isDisposisiVTEnabled", false);
                    oVerificationModel.setProperty("/isDisposisiVCEnabled", false);
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
                    oVerificationModel.setProperty("/isDisposisiVTEnabled", true);
                    oVerificationModel.setProperty("/isDisposisiVCEnabled", true);
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

            const oButtonStateModel = this.getView().getModel("buttonState");
            if (sUserStat === "VT" || sUserStat === "VC") {
                oButtonStateModel.setProperty("/isReviseVisible", false);
            } else {
                oButtonStateModel.setProperty("/isReviseVisible", true);
            }

            console.log("isUploadVisible for VT:", oVerificationModel.getProperty("/isUploadVisible"));
        },

        onDownloadDisposisi: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("detailApprovalMovModel");

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

        onCancelApproval: function () {
            // Close the approval dialog
            if (this._oApprovalDialog) {
                this._oApprovalDialog.close();
            }

            // Otherwise, re-enable all approval buttons
            const oButtonStateModel = this.getView().getModel("buttonState");
            if (oButtonStateModel) {
                oButtonStateModel.setProperty("/isApproveEnabled", true);
                oButtonStateModel.setProperty("/isRejectEnabled", true);
                oButtonStateModel.setProperty("/isReviseEnabled", true);
            }

            // Optionally refresh the view or reload data if needed
            if (sRequestId) {
                this._getDetailApprovalData(sRequestId);
                this.loadApprovalHistoryWithRequestor(sRequestId);
            }
        },

        // onCancelApproval: function () {
        //     // Close the approval dialog
        //     this._oApprovalDialog.close();

        //     // Do NOT re-enable buttons if action was already taken
        //     const sRequestId = this._oDetailApprovalMovModel.getProperty("/RequestId");
        //     if (sRequestId && localStorage.getItem("approvalMovAction_" + sRequestId) === "done") {
        //         return;
        //     }
        
        //     // Reset the button states to enable them again
        //     const oButtonStateModel = this.getView().getModel("buttonState");
        //     if (oButtonStateModel) {
        //         oButtonStateModel.setProperty("/isApproveEnabled", true);
        //         oButtonStateModel.setProperty("/isRejectEnabled", true);
        //         oButtonStateModel.setProperty("/isReviseEnabled", true);
        //     }

        //     // Optionally refresh the view or reload data if needed
        //     if (sRequestId) {
        //         this._getDetailApprovalData(sRequestId);
        //         this.loadApprovalHistoryWithRequestor(sRequestId);
        //     }
        
        // },

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