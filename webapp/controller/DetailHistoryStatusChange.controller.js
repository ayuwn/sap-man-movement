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

    return BaseController.extend("bsim.hcmapp.man.movement.controller.DetailHistoryStatusChange", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._oDetailHistoryStatusChangeModel = new JSONModel();
            this.getView().setModel(this._oDetailHistoryStatusChangeModel, "HistoryStatusChange");
            this.getRouter().getRoute("detailhistorystatuschange").attachPatternMatched(this._onDetailHistoryStatusChangeRouteMatched, this);

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

            let oEmployeeModel = new JSONModel({
            });
            this.getView().setModel(oEmployeeModel, "employee");

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
                        return;
                    }

                    const aFilteredRequests = aRequests.filter(request => request.EmployeeNumber === sEmployeeNumber);

                    if (aFilteredRequests.length === 0) {
                        console.warn(`No requests found for EmployeeNumber: ${sEmployeeNumber}`);
                        const oAttachmentModel = new sap.ui.model.json.JSONModel({ hasRequest: false });
                        this.getView().setModel(oAttachmentModel, "FilteredAttachments");
                        return;
                    }

                    const oLatestRequest = aFilteredRequests[0];
                    console.log("Most recent request:", oLatestRequest);

                    // Process attachments from the newest request
                    const aAttachments = oLatestRequest.toAttachmentView?.results || [];
                    // Filter for TypeDoc "SP" or "ST"
                    const aFilteredAttachments = aAttachments.filter(attachment =>
                        attachment.TypeDoc === "SP" || attachment.TypeDoc === "ST"
                    );

                    // Find the attachment with the highest SequenceNo
                    let oLatestAttachment = null;
                    if (aFilteredAttachments.length > 0) {
                        oLatestAttachment = aFilteredAttachments.reduce((latest, current) =>
                            (current.SequenceNo > latest.SequenceNo ? current : latest)
                        );
                    }

                    const oAttachmentModel = new sap.ui.model.json.JSONModel({
                        hasRequest: !!oLatestAttachment,
                        attachments: oLatestAttachment ? [oLatestAttachment] : []
                    });
                    this.getView().setModel(oAttachmentModel, "FilteredAttachments");

                    if (oLatestAttachment) {
                        console.log("Latest Attachment with TypeDoc 'SP' or 'ST':", oLatestAttachment);
                    } else {
                        console.warn("No attachments with TypeDoc 'SP' or 'ST' found.");
                    }
                },
                error: (oError) => {
                    console.error("Error loading grievances data with attachments:", oError);
                    const oAttachmentModel = new sap.ui.model.json.JSONModel({ hasRequest: false });
                    this.getView().setModel(oAttachmentModel, "FilteredAttachments");
                }
            });

            var oDate = new Date();
            oDate.setDate(1);

            var sFormattedEndDate = "9999-12-31";
            var sFormattedDate = oDate.toISOString().split("T")[0];

            this.getView().byId("effectiveDateEndStatusChange").setValue(sFormattedEndDate);
            this.getView().byId("effectiveDateStartStatusChange").setValue(sFormattedDate);
        },

        _currentUser: function (sRequestId) {
            console.log("Current User Function - Request ID:", sRequestId);

            return new Promise((resolve, reject) => {
                this._oBusy.open();

                const oDataModel = this.getOwnerComponent().getModel("StatusChange");

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

                                let userStat = "UNKNOWN";
                                if (oApprovalData && oApprovalData.results && oApprovalData.results.length > 0) {
                                    // Find the entry where ApproverId matches the logged-in user's ID
                                    const oMatchedApproval = oApprovalData.results.find(entry => entry.ApproverId === this._sEmployeeId);
                                    if (oMatchedApproval) {
                                        userStat = oMatchedApproval.Stat;
                                    }
                                }

                                // Combine the STAT field with the current user data
                                oCurrentUser.Stat = userStat;
                                const oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
                                this.getView().setModel(oCurrentUserModel, "currentUser");

                                if (typeof this._setVerificationAccess === "function") {
                                    this._setVerificationAccess();
                                }

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

        // _onDetailHistoryStatusChangeRouteMatched: function (oEvent) {
        //     var oArguments = oEvent.getParameter("arguments");
        //     var sRequestId = oArguments.RequestId;
        //     var EmployeeNumber = oArguments.EmployeeNumber;
        //     var oAppModel = this.getModel("appModel");

        //     if (!this._isValidGuid(sRequestId)) {
        //         console.error("Invalid Request ID format");
        //         MessageBox.error("Invalid Request ID format");
        //         return;
        //     }

        //     // Ensure currentUser is set before loading detail data
        //     this._currentUser(sRequestId)
        //         .then(() => {
        //             this._getDetailHistoryStatusChangeData(sRequestId);
        //             this.loadSubmittedDocuments(sRequestId);
        //             this.loadApprovalHistoryWithRequestor(sRequestId);
        //         })
        //         .catch((err) => {
        //             MessageBox.error("Failed to load user details.");
        //             this.onNavBack();
        //         });

        //     // Check for pending requests (this is a separate logic, can run in parallel)
        //     if (!EmployeeNumber) {
        //         MessageBox.error("Employee number is missing. Cannot proceed.");
        //         this.onNavBack();
        //         return;
        //     }

        //     var oModel = this.getOwnerComponent().getModel("StatusChange");
        //     oModel.read("/RequestSet", {
        //         filters: [
        //             new sap.ui.model.Filter("EmployeeNumber", sap.ui.model.FilterOperator.EQ, EmployeeNumber),
        //             new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.NE, "A7")
        //         ],
        //         success: (oData) => {
        //             const aRequests = oData.results || [];
        //             const hasPendingRequest = aRequests.some(
        //                 r => r.EmployeeNumber === EmployeeNumber && r.Status !== "A7"
        //             );

        //             if (hasPendingRequest) {
        //                 MessageBox.error(
        //                     "A movement request for this employee is already in progress. Please complete it before creating a new one.",
        //                     { onClose: () => this.onNavBack() }
        //                 );
        //                 return;
        //             }

        //             // Optionally, you can load employee data here if needed
        //             this._getEmployeeData(EmployeeNumber)
        //                 .then(() => {
        //                     console.log("Loaded employee data for:", EmployeeNumber);
        //                 })
        //                 .catch((err) => {
        //                     console.error("Error loading employee data:", err);
        //                     MessageBox.error("Failed to load employee data.");
        //                     this.onNavBack();
        //                 });
        //         },
        //         error: (err) => {
        //             console.error("Error checking existing requests:", err);
        //             MessageBox.error("Failed to check existing requests.", {
        //                 onClose: () => this.onNavBack()
        //             });
        //         }
        //     });
        // },

        _onDetailHistoryStatusChangeRouteMatched: function (oEvent) {
            var oArguments = oEvent.getParameter("arguments");
            var sRequestId = oArguments.RequestId;

            if (!this._isValidGuid(sRequestId)) {
                MessageBox.error("Invalid Request ID format");
                return;
            }

            // Only call detail after currentUser is set
            this._currentUser(sRequestId)
                .then(() => {
                    this._getDetailHistoryStatusChangeData(sRequestId);
                    this.loadSubmittedDocuments(sRequestId);
                    this.loadApprovalHistoryWithRequestor(sRequestId);
                })
                .catch(() => {
                    MessageBox.error("Failed to load user details.");
                    this.onNavBack();
                });
        },

        // _onDetailHistoryStatusChangeRouteMatched: function (oEvent) {
        //     var sRequestId = oEvent.getParameter("arguments").RequestId;
        //     if (this._isValidGuid(sRequestId)) {
        //         this._currentUser(sRequestId).then(() => {
        //             this._getDetailHistoryStatusChangeData(sRequestId);
        //         });
        //         this.loadSubmittedDocuments(sRequestId);
        //         this.loadApprovalHistoryWithRequestor(sRequestId);
        //     } else {
        //         console.error("Invalid Request ID format");
        //         MessageBox.error("Invalid Request ID format");
        //     }

        //     const EmployeeNumber = oArguments.EmployeeNumber;
        //     const oAppModel = this.getModel("appModel");
        
        //     if (!EmployeeNumber) {
        //         MessageBox.error("Employee number is missing. Cannot proceed.");
        //         this.onNavBack();
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel("StatusChange");

        //     oModel.read("/RequestSet", {
        //         filters: [
        //             new sap.ui.model.Filter("EmployeeNumber", sap.ui.model.FilterOperator.EQ, EmployeeNumber),
        //             new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.NE, "A7")
        //         ],
        //         success: (oData) => {
        //             const aRequests = oData.results || [];
        //             const hasPendingRequest = aRequests.some(
        //                 r => r.EmployeeNumber === EmployeeNumber && r.Status !== "A7"
        //             );
        
        //             if (hasPendingRequest) {
        //                 MessageBox.error(
        //                     "A movement request for this employee is already in progress. Please complete it before creating a new one.",
        //                     { onClose: () => this.onNavBack() }
        //                 );
        //                 return;
        //             }
        
        //             // Tidak ada request yang menggantung, lanjutkan
        //             this._getEmployeeData(EmployeeNumber)
        //                 .then(() => {
        //                     console.log("Loaded employee data for:", EmployeeNumber);

        //                     this._sRequestId = oArguments?.requestId || oAppModel?.getProperty("/selectedRequest/RequestId");
        
        //                     if (this._sRequestId) {
        //                         this._getRequestData();
        //                     } else {
        //                         this.getRouter().navTo("statuschange", {
        //                             EmployeeNumber: EmployeeNumber
        //                         });
                                
        //                     }
        //                 })
        //                 .catch((err) => {
        //                     console.error("Error loading employee data:", err);
        //                     MessageBox.error("Failed to load employee data.");
        //                     this.onNavBack();
        //                 });
        //         },
        //         error: (err) => {
        //             console.error("Error checking existing requests:", err);
        //             MessageBox.error("Failed to check existing requests.", {
        //                 onClose: () => this.onNavBack()
        //             });
        //         }
        //     });
        // },

        _isValidGuid: function (sGuid) {
            var guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            return guidRegex.test(sGuid);
        },

        _getDetailHistoryStatusChangeData: function (sRequestId) {
            var that = this;
            var oModel = this.getView().getModel("StatusChange");
            this._oBusy.open();

            // Retrieve data from RequestSet for the specific request
            oModel.read(`/RequestSet(guid'${sRequestId}')`, {
                success: function (oRequestData) {
                    console.log("RequestSet data retrieved successfully:", oRequestData);

                    var sEmployeeNumber = oRequestData.EmployeeNumber;
                    // Set employee number in the employee model
                    var oEmployeeModel = that.getView().getModel("employee");
                    if (oEmployeeModel) {
                        oEmployeeModel.setProperty("/EmployeeNumber", sEmployeeNumber);
                    } else {
                        oEmployeeModel = new sap.ui.model.json.JSONModel({ EmployeeNumber: sEmployeeNumber });
                        that.getView().setModel(oEmployeeModel, "employee");
                    }

                    oModel.read(`/EmployeeDetailSet('${sEmployeeNumber}')`, {
                        success: function (oEmployeeData) {
                            var oCombinedData = Object.assign({}, oEmployeeData, oRequestData);

                            // --- Begin: Set isEditable flag for revise by requestor ---
                            var isEditable = false;
                            var oCurrentUserModel = that.getView().getModel("currentUser");
                            var sCurrentUserEmpNo = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");

                            console.log("Status:", oCombinedData.Status);
                            console.log("StatusText:", oCombinedData.StatusText);
                            // console.log("PicNumber:", oCombinedData.PicNumber);
                            console.log("PicNumber:", oCombinedData.PicNumber, "CurrentUser:", sCurrentUserEmpNo)

                            if (
                                oCombinedData.Status === "V" && // Status is Revise
                                oCombinedData.PicNumber === sCurrentUserEmpNo // Current user is requestor
                            ) {
                                isEditable = true;
                            }
                            oCombinedData.isEditable = isEditable;
                            // --- End: Set isEditable flag ---

                            that._oDetailHistoryStatusChangeModel.setData(oCombinedData);
                            // Ensure visibility logic is applied after data is set
                            setTimeout(function () {
                                if (oCombinedData.Massg) {
                                    that.applyReasonVisibility(oCombinedData.Massg);
                                }
                            }, 0);

                            console.log("Set isEditable in model:", oCombinedData.isEditable);
                            console.log("Model data after set:", that._oDetailHistoryStatusChangeModel.getData());

                            // Debug: Check the binding in the view
                            var oInput = that.byId("homebaseTujuanStatusChange"); // Change to your actual input ID
                            if (oInput) {
                                // Check the editable property and binding info
                                console.log("Input editable property:", oInput.getEditable());
                                console.log("Input binding info:", oInput.getBindingInfo("editable"));
                            }
                            that._oBusy.close();
                        },
                        error: function (oError) {
                            console.error("Error retrieving EmployeeDetailSet data:", oError);
                            MessageBox.error("Failed to load employee data");
                            that._oBusy.close();
                        }
                    });
                },
                error: function (oError) {
                    console.error("Error retrieving RequestSet data:", oError);
                    MessageBox.error("Failed to load request data");
                    that._oBusy.close();
                }
            });
        },

        _getEmployeeData: function (EmployeeNumber) {
            return new Promise((resolve, reject) => {
                // Define paths for EmployeeSet and EmployeeDetailSet
                const sEmployeePath = `/EmployeeSet('${EmployeeNumber}')`;
                const sEmployeeDetailPath = `/EmployeeDetailSet('${EmployeeNumber}')`;
        
                let oEmployeeModel = this.getView().getModel("employee");
                let oEmployeeDetailModel = this.getView().getModel("employeeDetail");
        
                this._oBusy.open();
        
                // Fetch EmployeeSet data
                this.readEntity(sEmployeePath)
                    .then((employeeResult) => {
                        if (!employeeResult) {
                            MessageBox.error(this.getResourceBundle().getText("msgNotAuthorized"), {
                                actions: ["Exit"],
                                onClose: (sAction) => {
                                    this._navBack();
                                },
                            });
                            return Promise.reject("No EmployeeSet data found.");
                        }
        
                        // Set EmployeeSet data to the model
                        oEmployeeModel.setData(employeeResult);
                        console.log("EmployeeSet Data loaded:", employeeResult);
        
                        // Fetch EmployeeDetailSet data
                        return this.readEntity(sEmployeeDetailPath);
                    })
                    .then((employeeDetailResult) => {
                        if (employeeDetailResult) {
                            // Set EmployeeDetailSet data to the model
                            if (!oEmployeeDetailModel) {
                                oEmployeeDetailModel = new sap.ui.model.json.JSONModel();
                                this.getView().setModel(oEmployeeDetailModel, "employeeDetail");
                            }
                            oEmployeeDetailModel.setData(employeeDetailResult);
                            console.log("EmployeeDetailSet Data loaded:", employeeDetailResult);
                        } else {
                            console.warn("EmployeeDetailSet data is missing.");
                        }
                        resolve(); // Resolve the Promise after successful data loading
                    })
                    .catch((error) => {
                        console.error("Error loading employee data:", error);
                        MessageBox.error("Error loading employee details");
                        reject(error); // Reject the Promise in case of an error
                    })
                    .finally(() => {
                        this._oBusy.close();
                    });
            });
        },

        // applyReasonVisibility: function(sReasonKey) {
        //     // Homebase Tujuan fields
        //     var oHomebaseTujuanLabel = this.byId("homebaseTujuanLabel");
        //     var oHomebaseTujuan = this.byId("homebaseTujuanStatusChange");
        //     var oHomebaseTujuanText = this.byId("homebaseTujuanTextStatusChange");
        //     var oHomebaseAsal = this.byId("homebaseAsalStatusChange");
        //     var oHomebaseAsalText = this.byId("homebaseAsalTextStatusChange");

        //     // Kontrak fields
        //     var oKontrakStatusChange = this.byId("KontrakStatusChange");
        //     var oKontrakText = this.byId("kontrakTextStatusChange");
        //     var oValidDateLabel = this.byId("validDateLabel");
        //     var oValidDateStart = this.byId("validDateStartStatusChange");
        //     var oValidDateDesc = this.byId("validDateDesc");

        //     // --- Homebase Tujuan fields ---
        //     if (sReasonKey === "03") {
        //         if (oHomebaseTujuanLabel) oHomebaseTujuanLabel.setVisible(true);
        //         if (oHomebaseTujuan) oHomebaseTujuan.setVisible(true);
        //         if (oHomebaseTujuanText) oHomebaseTujuanText.setVisible(true);
        //         if (oHomebaseAsal) oHomebaseAsal.setVisible(true);
        //         if (oHomebaseAsalText) oHomebaseAsalText.setVisible(true);

        //         // Hide kontrak and valid date fields
        //         if (oKontrakStatusChange) oKontrakStatusChange.setVisible(false);
        //         if (oKontrakText) oKontrakText.setVisible(false);
        //         if (oValidDateLabel) oValidDateLabel.setVisible(false);
        //         if (oValidDateStart) oValidDateStart.setVisible(false);
        //         if (oValidDateDesc) oValidDateDesc.setVisible(false);
        //     } else {
        //         // Hide homebase fields
        //         if (oHomebaseTujuanLabel) oHomebaseTujuanLabel.setVisible(false);
        //         if (oHomebaseTujuan) oHomebaseTujuan.setVisible(false);
        //         if (oHomebaseTujuanText) oHomebaseTujuanText.setVisible(false);
        //         if (oHomebaseAsal) oHomebaseAsal.setVisible(false);
        //         if (oHomebaseAsalText) oHomebaseAsalText.setVisible(false);

        //         // Show kontrak and valid date fields
        //         if (oKontrakStatusChange) oKontrakStatusChange.setVisible(true);
        //         if (oKontrakText) oKontrakText.setVisible(true);
        //         if (oValidDateLabel) oValidDateLabel.setVisible(true);
        //         if (oValidDateStart) oValidDateStart.setVisible(true);
        //         if (oValidDateDesc) oValidDateDesc.setVisible(true);
        //     }
        // },

        applyReasonVisibility: function(sReasonKey) {
            // Homebase Tujuan fields
            var oHomebaseTujuan = this.byId("homebaseTujuanStatusChange");
            var oHomebaseTujuanH = this.byId("homebaseTujuanStatusChangeH");
            var oHomebaseTujuanText = this.byId("homebaseTujuanTextStatusChange");
            var oNewHomebaseTujuanText = this.byId("newHomebaseTujuanTextStatusChange");
            var oHomebaseAsal = this.byId("homebaseAsalStatusChange");
            var oHomebaseAsalText = this.byId("homebaseAsalTextStatusChange");

            // Kontrak fields
            var oKontrakStatusChange = this.byId("KontrakStatusChange");
            var oKontrakStatusChangeH = this.byId("KontrakStatusChangeH");
            var oKontrakText = this.byId("kontrakTextStatusChange");
            var oNewKontrakText = this.byId("newKontrakTextStatusChange");
            var oValidDateLabel = this.byId("validDateLabel");
            var oValidDateStart = this.byId("validDateStartStatusChange");
            var oValidDateStartH = this.byId("validDateStartStatusChangeH");
            var oValidDateDesc = this.byId("validDateDesc");

            if (sReasonKey === "02") {
                // Hide homebase tujuan fields
                [oHomebaseTujuan, oHomebaseTujuanH, oHomebaseTujuanText, oNewHomebaseTujuanText, oHomebaseAsal, oHomebaseAsalText].forEach(function(ctrl) {
                    if (ctrl) ctrl.setVisible(false);
                });
                // Show kontrak and valid date fields
                [oKontrakStatusChange, oKontrakStatusChangeH, oKontrakText, oNewKontrakText, oValidDateLabel, oValidDateStart, oValidDateStartH, oValidDateDesc].forEach(function(ctrl) {
                    if (ctrl) ctrl.setVisible(true);
                });
            } else if (sReasonKey === "03") {
                // Show homebase tujuan fields
                [oHomebaseTujuan, oHomebaseTujuanH, oHomebaseTujuanText, oNewHomebaseTujuanText, oHomebaseAsal, oHomebaseAsalText].forEach(function(ctrl) {
                    if (ctrl) ctrl.setVisible(true);
                });
                // Hide kontrak and valid date fields
                [oKontrakStatusChange, oKontrakStatusChangeH, oKontrakText, oNewKontrakText, oValidDateLabel, oValidDateStart, oValidDateStartH, oValidDateDesc].forEach(function(ctrl) {
                    if (ctrl) ctrl.setVisible(false);
                });
            } else {
                // Default: show all fields
                [oHomebaseTujuan, oHomebaseTujuanH, oHomebaseTujuanText, oNewHomebaseTujuanText, oHomebaseAsal, oHomebaseAsalText,
                oKontrakStatusChange, oKontrakStatusChangeH, oKontrakText, oNewKontrakText, oValidDateLabel, oValidDateStart, oValidDateStartH, oValidDateDesc
                ].forEach(function(ctrl) {
                    if (ctrl) ctrl.setVisible(true);
                });
            }
        },

        // applyReasonVisibility: function(sReasonKey) {
        //     // Homebase Tujuan fields
        //     var oHomebaseTujuan = this.byId("homebaseTujuanStatusChange");
        //     var oHomebaseTujuanH = this.byId("homebaseTujuanStatusChangeH");
        //     var oHomebaseTujuanText = this.byId("homebaseTujuanTextStatusChange");
        //     var oNewHomebaseTujuanText = this.byId("newHomebaseTujuanTextStatusChange");
        //     var oHomebaseAsal = this.byId("homebaseAsalStatusChange");
        //     var oHomebaseAsalText = this.byId("homebaseAsalTextStatusChange");

        //     // Kontrak fields
        //     var oKontrakStatusChange = this.byId("KontrakStatusChange");
        //     var oKontrakStatusChangeH = this.byId("KontrakStatusChangeH");
        //     var oKontrakText = this.byId("kontrakTextStatusChange");
        //     var oNewKontrakText = this.byId("newKontrakTextStatusChange");
        //     var oValidDateLabel = this.byId("validDateLabel");
        //     var oValidDateStart = this.byId("validDateStartStatusChange");
        //     var oValidDateStartH = this.byId("validDateStartStatusChangeH");
        //     var oValidDateDesc = this.byId("validDateDesc");

        //     // If Massg is "02", hide homebase tujuan fields
        //     if (sReasonKey === "02") {
        //         if (oHomebaseTujuan) oHomebaseTujuan.setVisible(false);
        //         if (oHomebaseTujuanH) oHomebaseTujuanH.setVisible(false);
        //         if (oHomebaseTujuanText) oHomebaseTujuanText.setVisible(false);
        //         if (oNewHomebaseTujuanText) oNewHomebaseTujuanText.setVisible(false);
        //         if (oHomebaseAsal) oHomebaseAsal.setVisible(false);
        //         if (oHomebaseAsalText) oHomebaseAsalText.setVisible(false);

        //         // Show kontrak and valid date fields
        //         if (oKontrakStatusChange) oKontrakStatusChange.setVisible(true);
        //         if (oKontrakStatusChangeH) oKontrakStatusChangeH.setVisible(true);
        //         if (oKontrakText) oKontrakText.setVisible(true);
        //         if (oNewKontrakText) oNewKontrakText.setVisible(true);
        //         if (oValidDateLabel) oValidDateLabel.setVisible(true);
        //         if (oValidDateStart) oValidDateStart.setVisible(true);
        //         if (oValidDateStartH) oValidDateStartH.setVisible(true);
        //         if (oValidDateDesc) oValidDateDesc.setVisible(true);
        //     } else if (sReasonKey === "03") {
        //         // Show homebase tujuan fields
        //         if (oHomebaseTujuan) oHomebaseTujuan.setVisible(true);
        //         if (oHomebaseTujuanH) oHomebaseTujuanH.setVisible(true);
        //         if (oHomebaseTujuanText) oHomebaseTujuanText.setVisible(true);
        //         if (oNewHomebaseTujuanText) oNewHomebaseTujuanText.setVisible(true);
        //         if (oHomebaseAsal) oHomebaseAsal.setVisible(true);
        //         if (oHomebaseAsalText) oHomebaseAsalText.setVisible(true);

        //         // Hide kontrak and valid date fields
        //         if (oKontrakStatusChange) oKontrakStatusChange.setVisible(false);
        //         if (oKontrakStatusChangeH) oKontrakStatusChangeH.setVisible(false);
        //         if (oKontrakText) oKontrakText.setVisible(false);
        //         if (oNewKontrakText) oNewKontrakText.setVisible(false);
        //         if (oValidDateLabel) oValidDateLabel.setVisible(false);
        //         if (oValidDateStart) oValidDateStart.setVisible(false);
        //         if (oValidDateStartH) oValidDateStartH.setVisible(false);
        //         if (oValidDateDesc) oValidDateDesc.setVisible(false);
        //     } else {
        //         // Default: show all fields
        //         if (oHomebaseTujuan) oHomebaseTujuan.setVisible(true);
        //         if (oHomebaseTujuanH) oHomebaseTujuanH.setVisible(true);
        //         if (oHomebaseTujuanText) oHomebaseTujuanText.setVisible(true);
        //         if (oNewHomebaseTujuanText) oNewHomebaseTujuanText.setVisible(true);
        //         if (oHomebaseAsal) oHomebaseAsal.setVisible(true);
        //         if (oHomebaseAsalText) oHomebaseAsalText.setVisible(true);

        //         if (oKontrakStatusChange) oKontrakStatusChange.setVisible(true);
        //         if (oKontrakStatusChangeH) oKontrakStatusChangeH.setVisible(true);
        //         if (oKontrakText) oKontrakText.setVisible(true);
        //         if (oNewKontrakText) oNewKontrakText.setVisible(true);
        //         if (oValidDateLabel) oValidDateLabel.setVisible(true);
        //         if (oValidDateStart) oValidDateStart.setVisible(true);
        //         if (oValidDateStartH) oValidDateStartH.setVisible(true);
        //         if (oValidDateDesc) oValidDateDesc.setVisible(true);
        //     }
        // },

        onSubmitEdit: function () {
            // Get employee model
            let oEmployeeModel = this.getView().getModel("employee");
            let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
            
            // Get the logged-in user's employee number
            let oCurrentUserModel = this.getView().getModel("currentUser");
            let sLoggedInEmployeeId = oCurrentUserModel ? oCurrentUserModel.getProperty("/EmployeeNumber") : null;

            if (!oSelectedEmp) {
                sap.m.MessageBox.error("Please select an employee first.");
                return;
            }

            if (!sLoggedInEmployeeId) {
                sap.m.MessageBox.error("Unable to retrieve logged-in user details.");
                return;
            }

            // Ensure the user cannot perform actions on themselves
            if (oSelectedEmp === sLoggedInEmployeeId) {
                sap.m.MessageBox.error("You cannot perform actions on yourself.");
                return;
            }

            // Confirm with user before sending
            sap.m.MessageBox.confirm("Do you want to submit this request?", {
                actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                emphasizedAction: sap.m.MessageBox.Action.NO,
                initialFocus: sap.m.MessageBox.Action.NO,
                onClose: (sAction) => {
                    if (sAction === sap.m.MessageBox.Action.YES) {
                        this._updateRequest();
                    } else {
                        return false;
                    }
                }
            });
        },

        _updateRequest: function () {
            const oEmployeeModel = this.getView().getModel("employee");
            const oEmployeeDetailModel = this.getView().getModel("employeeDetail");
            const oCurrentUserModel = this.getView().getModel("currentUser");

            if (!oEmployeeModel || !oCurrentUserModel) {
                sap.m.MessageBox.error("Required models are not available.");
                return;
            }

            var sReasonKey = this.byId("reasonStatusChange").getValue();
            var oFileAttachmentModel = this.getView().getModel("fileAttachment");
            var aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
            if (sReasonKey !== "03" && (!aFiles || aFiles.length === 0)) {
                MessageBox.error("Mohon unggah dokumen yang diperlukan.");
                return;
            }

            const oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
            const sLoggedInEmployeeId = oCurrentUserModel.getProperty("/EmployeeNumber");
            const oPlansReqDesc = oCurrentUserModel.getProperty("/EmployeePositionLongtext");
            const oNamaKantorReq = oCurrentUserModel.getProperty("/NamaKantorReq");
            const oDivisiDescReq = oCurrentUserModel.getProperty("/DivisionText");
            const sBeginDate = oEmployeeDetailModel.getProperty("/BeginDate");

            if (!sLoggedInEmployeeId) {
                MessageBox.error("Unable to retrieve logged-in user details.");
                return;
            }

            if (!oSelectedEmp) {
                MessageBox.error("Please select an employee first.");
                return;
            }

            const getFormattedDate = (controlId) => {
                const control = this.byId(controlId);
                if (control && typeof control.getDateValue === "function") {
                    const dateValue = control.getDateValue();
                    return dateValue ? this.formatter.formatDateUtc(dateValue) : null;
                }
                return null;
            };

            const oData = this.getView().getModel("HistoryStatusChange").getData();
            const sPath = "/RequestSet(guid'" + oData.RequestId + "')";

            // Show busy dialog
            if (!this._oBusyDialog) {
                this._oBusyDialog = new sap.m.BusyDialog();
            }
            this._oBusyDialog.setTitle("Please wait...");
            this._oBusyDialog.setText("Updating request...");
            this._oBusyDialog.open();

            const oModel = this.getView().getModel("StatusChange");
            const sRequestId = oData.RequestId;
            const sToApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;

            // Read current toApproval data to find the correct ApproverId (e.g., the one who revised)
            oModel.read(sToApprovalPath, {
                success: (oApprovalData) => {
                    // Find the entry to update (example: Stat === "V" for verify)
                    let oEntry = (oApprovalData.results || []).find(a => a.Status === "V");
                    if (!oEntry) {
                        oEntry = (oApprovalData.results || [])[0];
                    }
                    if (!oEntry) {
                        this._oBusyDialog.close();
                        sap.m.MessageToast.show("No approval entry found, skipping approval update.");
                        this.getRouter().navTo("history");
                        return;
                    }

                    const oDateTime = this._createApprovalDateTime();

                    // Merge approval fields into oPayload
                    const oPayload = {
                        RequestId: oData.RequestId,
                        EmployeeNumber: oSelectedEmp,
                        PicNumber: sLoggedInEmployeeId,
                        Massg: this.byId("reasonStatusChangeH").getValue(),
                        MassgDesc: this.byId("reasonTextStatusChange").getText(),
                        TipeKontrakDest: this.byId("KontrakStatusChange").getValue(),
                        TipeKontrakDescDest: this.byId("kontrakTextStatusChange").getText(),
                        BeginDate: getFormattedDate("actDateStartStatusChange"),
                        EndDate: getFormattedDate("actDateEndStatusChange"),
                        StartDate: sBeginDate,
                        ZbegdaEfktf: getFormattedDate("effectiveDateStartStatusChange"),
                        ZenddaEfktf: getFormattedDate("effectiveDateEndStatusChange"),
                        ValidDate: getFormattedDate("validDateStartStatusChange"),
                        HasilPerformance: this.getView().getModel("performance").getProperty("/selectedPerformance/Value") || "",
                        TotalNilai: this.byId("totalNilaiStatusChange").getValue(),
                        KategoriEvaluasi: this.getView().getModel("evaluasi").getProperty("/selectedEvaluasi/Value") || "",
                        Adjstmn: this.getView().getModel("dropdown").getProperty("/selectedSalaryAdj") || "",
                        Zsalary: this.byId("salaryAdjValueStatusChange").getValue() ? this.byId("salaryAdjValueStatusChange").getValue().replace(/\D/g, '') : "0",
                        Zdasar2: this.byId("basicConStatusChange").getValue(),
                        HbsDest: this.byId("homebaseTujuanStatusChange").getValue(),
                        HbsDescDest: this.byId("homebaseTujuanTextStatusChange").getText(),
                        PlansReqDesc: oPlansReqDesc,
                        NamaKantorReq: oNamaKantorReq,
                        DivisiDescReq: oDivisiDescReq,
                        PersgAsl: this.byId("GroupStatusChange").getValue(),
                        PersgAslDesc: this.byId("GroupTextStatusChange").getText(),
                        PerskAsl: this.byId("SubGroupStatusChange").getValue(),
                        PerskAslDesc: this.byId("SubGroupTextStatusChange").getText(),
                        PlansAsl: this.byId("PositionStatusChange").getValue(),
                        PlansDescAsl: this.byId("PositionTextStatusChange").getText(),
                        WerksDescAsl: this.byId("PerareaTextStatusChange").getText(),
                        WerksAsl: this.byId("PerareaStatusChange").getValue(),
                        BtrtlDescAsl: this.byId("PersubareaTextStatusChange").getText(),
                        BtrtlAsl: this.byId("PersubareaStatusChange").getValue(),
                        OuAsl: this.byId("UnitOrgStatusChange").getValue(),
                        OuDecAsl: this.byId("UnitOrgTextStatusChange").getText(),
                        DivisiAsl: this.byId("DivisiStatusChange").getValue(),
                        DivisiDescAsl: this.byId("DivisiTextStatusChange").getText(),
                        TipeKontrakAsl: this.byId("CurrentTipeKontrakStatusChange").getValue(),
                        TipeKontrakDescAsl: this.byId("CurrentTipeKontrakTextStatusChange").getText(),
                        HbsAsl: this.byId("homebaseAsalStatusChange1").getValue(),
                        HbsDescAsl: this.byId("homebaseAsalTextStatusChange").getText(),
                        // Approval fields
                        SequenceNumber: oEntry.SequenceNumber,
                        Stat: "A1",
                        ObjectType: "P",
                        ApproverId: oEntry.ApproverId,
                        Abbreviation: oEntry.Abbreviation,
                        Status: "S",
                        StatusText: "Submitted",
                        ApprovalDate: oDateTime.ApprovalDate,
                        ApprovalTime: oDateTime.ApprovalTime,
                        Notes: "",
                        ApprovalUser: oEntry.ApproverUser,
                    };

                    oModel.update(sPath, oPayload, {
                        success: () => {
                            this._oBusyDialog.close();
                            sap.m.MessageToast.show("Request and approval updated successfully.");
                            this.getRouter().navTo("history");
                        },
                        error: () => {
                            this._oBusyDialog.close();
                            sap.m.MessageBox.error("Failed to update request and approval.");
                        }
                    });
                },
                error: () => {
                    this._oBusyDialog.close();
                    sap.m.MessageBox.error("Failed to read approval data.");
                }
            });
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

        _loadTipeKontrakData: function() {
            return new Promise((resolve, reject) => {
                const oModel= this.getOwnerComponent().getModel("StatusChange");
                oModel.read("/ValueHelpPerubahanTypeSet", {
                    success: (oData) => {
                        const oTipeKontrakModel = new JSONModel(oData.results);
                        this.getView().setModel(oTipeKontrakModel, "tipekontrak");
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load tipe kontrak data");
                        reject(oError);
                    }
                });
            });
        },

        handleValueHelpTipeKontrak: function() {
            if (!this._oValueHelpTipeKontrakDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpTipeKontrak",
                    controller: this
                }).then(function(oDialog) {
                    this._oValueHelpTipeKontrakDialog = oDialog;
                    this._oValueHelpTipeKontrakDialog.setModel(this.getView().getModel("tipekontrak"), "tipekontrak");
                    this.getView().addDependent(this._oValueHelpTipeKontrakDialog);

                    this._loadTipeKontrakData().then(() => {
                        this._oValueHelpTipeKontrakDialog.open();
                    });

                }.bind(this));
            } else {
                this._oValueHelpTipeKontrakDialog.open();
            }
        },

        handleSearchTipeKontrak: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oKeyFilter = new Filter("Key", FilterOperator.Contains, sValue);
            var oValueFilter = new Filter("Value", FilterOperator.Contains, sValue);

            var oCombinedFilter = new Filter({
                filters: [oKeyFilter, oValueFilter],
                and: false
            });

            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oCombinedFilter]);
        },

        handleCloseTipeKontrak: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oTipeKontrakModel = this.getView().getModel("tipekontrak");
                
                oTipeKontrakModel.setProperty("/selectedTipeKontrak", oSelectedItem);
                this.byId("KontrakStatusChange").setValue(oSelectedItem.Key);
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        handlePerformanceChange: function(oEvent) {
            const sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            const sSelectedText = oEvent.getParameter("selectedItem").getText();
            const oPerformanceModel = this.getView().getModel("performance");
            oPerformanceModel.setProperty("/selectedPerformance", {
                Key: sSelectedKey,
                Value: sSelectedText
            });
            console.log("Selected Performance:", sSelectedKey, sSelectedText);
        },

        _loadEvaluasiData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("StatusChange");
                oModel.read("/ValueHelpKategoriEvaluasiSet", {
                    success: (oData) => {
                        // console.log("Eva Data Loaded:", oData.results);
                        const oEvaluasiModel = new JSONModel({ items: oData.results});
                        this.getView().setModel(oEvaluasiModel, "evaluasi");
                        console.log("Evaluasi Model:", this.getView().getModel("evaluasi").getData());
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load evaluasi data.");
                        reject(oError);
                    }
                });
            });
        },

        handleEvaluasiChange: function(oEvent) {
            const sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            const sSelectedText = oEvent.getParameter("selectedItem").getText();

            const oEvaluasiModel = this.getView().getModel("evaluasi");
            oEvaluasiModel.setProperty("/selectedEvaluasi", {
                Key: sSelectedKey,
                Value: sSelectedText
            });

            console.log("Selected Evaluasi:", sSelectedKey, sSelectedText);
        },

        onSalaryAdjChange: function (oEvent) {
            const sSelectedKey = oEvent.getSource().getSelectedKey();
            const oModel = this.getView().getModel("dropdown");
        
            if (sSelectedKey === "1") {
                oModel.setProperty("/isSalaryAdjEnabled", true);
            } else if (sSelectedKey === "2") { 
                oModel.setProperty("/isSalaryAdjEnabled", false);
                this.byId("salaryAdjValueStatusChange").setValue(""); 
            }
        },

        _loadHomebaseData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("StatusChange");
                oModel.read("/ValueHelpHomebaseTujuanSet", {
                    success: (oData) => {
                        const oHomebaseModel = new JSONModel(oData.results);
                        this.getView().setModel(oHomebaseModel, "homebase");
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load homebase data.");
                        reject(oError);
                    }
                });
            });
        },

        handleValueHelpHomebase: function() {
            if (!this._oValueHelpHomebaseDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpHomebase",
                    controller: this
                }).then(function(oDialog) {
                    this._oValueHelpHomebaseDialog = oDialog;
                    this._oValueHelpHomebaseDialog.setModel(this.getView().getModel("homebase"), "homebase");
                    this.getView().addDependent(this._oValueHelpHomebaseDialog);

                    this._loadHomebaseData().then(() => {
                        this._oValueHelpHomebaseDialog.open();
                    });
                }.bind(this));
            } else {
                this._oValueHelpHomebaseDialog.open();
            }
        },

        handleSearchHomebase: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oKeyFilter = new Filter("Key", FilterOperator.Contains, sValue);
            var oValueFilter = new Filter("Value", FilterOperator.Contains, sValue);

            var oCombinedFilter = new Filter({
                filters: [oKeyFilter, oValueFilter],
                and: false
            });

            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oCombinedFilter]);
        },

        handleCloseHomebase: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oHomebaseModel = this.getView().getModel("homebase");
                // Set the entire object, not just Key/Value
                oHomebaseModel.setProperty("/selectedHomebase", oSelectedItem);
                this.byId("homebaseTujuanStatusChange").setValue(oSelectedItem.Key);
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        handleLiveChange: function (oEvent) {
            var oTextArea = oEvent.getSource(),
                iValueLength = oTextArea.getValue().length,
                iMaxLength = oTextArea.getMaxLength(),
                sState = iValueLength > iMaxLength ? ValueState.Warning : ValueState.None;

            oTextArea.setValueState(sState);
        },

        // _getDetailHistoryStatusChangeData: function (sRequestId) {
        //     var that = this;
        //     var oModel = this.getView().getModel("StatusChange");
        //     this._oBusy.open();
            
        //     // Retrieve data from RequestSet for the specific request
        //     oModel.read(`/RequestSet(guid'${sRequestId}')`, {
        //         success: function (oRequestData) {
        //             console.log("RequestSet data retrieved successfully:", oRequestData);
        
        //             // Retrieve data from EmployeeDetailSet for the specific employee
        //             var sEmployeeNumber = oRequestData.EmployeeNumber;
        //             oModel.read(`/EmployeeDetailSet('${sEmployeeNumber}')`, {
        //                 success: function (oEmployeeData) {
        //                     console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
        //                     var oCombinedData = Object.assign({}, oRequestData, oEmployeeData, {
        //                         PositionName: oEmployeeData.PositionName || oRequestData.PositionName,
        //                     });
        //                     // Combine data from RequestSet and EmployeeDetailSet
        //                     // var oCombinedData = Object.assign({}, oRequestData, oEmployeeData);
        
        //                     // Set the combined data in the DetailHistoryModel
        //                     that._oDetailHistoryStatusChangeModel.setData(oCombinedData);
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

        loadApprovalHistoryWithRequestor: function (sRequestId) {
            if (!sRequestId || !this._isValidGuid(sRequestId)) {
                MessageBox.error("Invalid Request ID format. Cannot fetch approval history.");
                return;
            }

            const oModel = this.getOwnerComponent().getModel("StatusChange"); 

            sap.ui.core.BusyIndicator.show(0);

            const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
            const sToApprovalPath = `${sRequestPath}/toApproval`;

            oModel.read(sRequestPath, {
                success: function (oRequestData) {
                    // Get requestor info
                    const sEmployeePath = `/EmployeeDetailSet('${oRequestData.PicNumber}')`;
                    oModel.read(sEmployeePath, {
                        success: function (oEmployeeData) {
                            const sFormattedName = oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || "Unknown";
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
                                    const aApprovalHistory = [oRequestorEntry].concat(oApprovalData.results || []);
                                    const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: aApprovalHistory });
                                    const oTable = this.getView().byId("idApprTable");
                                    if (oTable) {
                                        oTable.setModel(oApprovalHistoryModel, "appr");
                                    }
                                    sap.ui.core.BusyIndicator.hide();
                                }.bind(this),
                                error: function () {
                                    // Only requestor entry if approval data fails
                                    const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: [oRequestorEntry] });
                                    const oTable = this.getView().byId("idApprTable");
                                    if (oTable) {
                                        oTable.setModel(oApprovalHistoryModel, "appr");
                                    }
                                    sap.ui.core.BusyIndicator.hide();
                                }.bind(this)
                            });
                        }.bind(this),
                        error: function () {
                            MessageBox.error("Failed to load employee data for approval history.");
                            sap.ui.core.BusyIndicator.hide();
                        }
                    });
                }.bind(this),
                error: function () {
                    MessageBox.error("Failed to load request data for approval history.");
                    sap.ui.core.BusyIndicator.hide();
                }
            });
        },

        loadSubmittedDocuments: function (sRequestId) {
            if (!sRequestId) {
                MessageBox.error("No request ID found. Cannot fetch documents.");
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel("StatusChange");
            const oView = this.getView();
        
            // Construct the path for FileAttachmentViewSet
            const sPath = `/FileAttachmentViewSet`;
        
            // Define filters for the RequestId
            const aFilters = [
                new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
            ];
        
            // Fetch documents from FileAttachmentViewSet
            oModel.read(sPath, {
                filters: aFilters,
                success: function (oData) {
                    console.log("Documents fetched successfully from FileAttachmentViewSet:", oData.results);
        
                    // Bind the data to the fileAttachment model
                    const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
                    oView.setModel(oFileAttachmentModel, "fileAttachmentView");
                },
                error: function (oError) {
                    console.error("Error fetching documents from FileAttachmentViewSet:", oError);
                    MessageBox.error("Failed to fetch submitted documents.");
                }
            });
        },

        onShowDocument: function (oEvent) {
            // Get the binding context of the button
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("fileAttachmentView");
        
            // Get the URL from the binding context
            const sUrl = oContext.getProperty("Url");
        
            // Open the URL in a new tab
            if (sUrl) {
                window.open(sUrl, "_blank");
            } else {
                sap.m.MessageToast.show("No URL available for this document.");
            }
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

        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("history", {}, true);
            }
        }

    });
});