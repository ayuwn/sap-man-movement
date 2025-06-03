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

    return BaseController.extend("bsim.hcmapp.man.movement.controller.DetailApprovalStatusChange", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._oDetailApprovalStatModel = new JSONModel();
            this.getView().setModel(this._oDetailApprovalStatModel, "detailApprovalStatModel");
            this.getView().byId("downloadDisposisiStat").bindElement({
                path: "/",
                model: "detailApprovalStatModel",
            });

            const oButtonStateModel = new sap.ui.model.json.JSONModel({
                isApproveEnabled: false,
                isRejectEnabled: false,
                isReviseEnabled: false,
                isReviseVisible: true
            });
            this.getView().setModel(oButtonStateModel, "buttonState");

            // const oButtonStateModel = new sap.ui.model.json.JSONModel({
            //     isApproveEnabled: true,
            //     isRejectEnabled: true
            // });
            // this.getView().setModel(oButtonStateModel, "buttonState");

            this.getRouter().getRoute("detailapprovalstatuschange").attachPatternMatched(this._onDetailApprovalStatRouteMatched, this);

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
                selectedIndex: -1
            });
            this._oView.setModel(oDisposisiApprovalModel, "disposisiApprovalStat1");
        },

        // _onDetailApprovalStatRouteMatched: function (oEvent) {
        //     const sRequestId = oEvent.getParameter("arguments").RequestId;
        //     if (!this._isValidGuid(sRequestId)) {
        //         MessageBox.error("Invalid Request ID format");
        //         return;
        //     }
        //     this._oDetailApprovalStatModel.setProperty("/RequestId", sRequestId);
        //     this._oSelectedModel = this.getOwnerComponent().getModel("StatusChange");

        //     this._getDetailApprovalData(sRequestId).then(() => {
        //         this._updateDisposisiSelection();
        //     });

        //     this._currentUser(sRequestId)
        //         .then(() => {
        //             const oCurrentUserModel = this.getView().getModel("currentUser");
        //             const sEmployeeId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");
        //             const oButtonStateModel = this.getView().getModel("buttonState");

        //             this._oSelectedModel.read(`/RequestSet(guid'${sRequestId}')/toApproval`, {
        //                 success: (oData) => {
        //                     const aUserApprovals = oData.results.filter(entry => entry.ApproverId === sEmployeeId);
        //                     const oActiveApprovalEntry = aUserApprovals.find(entry => !entry.Status) || null;
        //                     this._oDetailApprovalStatModel.setProperty("/activeApprovalEntry", oActiveApprovalEntry);

        //                     if (!oActiveApprovalEntry) {
        //                         oButtonStateModel.setProperty("/isApproveEnabled", false);
        //                         oButtonStateModel.setProperty("/isRejectEnabled", false);
        //                         oButtonStateModel.setProperty("/isReviseEnabled", false);
        //                         return;
        //                     }
        //                     oButtonStateModel.setProperty("/isApproveEnabled", true);
        //                     oButtonStateModel.setProperty("/isRejectEnabled", true);
        //                     oButtonStateModel.setProperty("/isReviseEnabled", true);
        //                 },
        //                 error: () => {
        //                     oButtonStateModel.setProperty("/isApproveEnabled", false);
        //                     oButtonStateModel.setProperty("/isRejectEnabled", false);
        //                     oButtonStateModel.setProperty("/isReviseEnabled", false);
        //                 }
        //             });
        //         })
        //         .catch((error) => {
        //             console.error("Error setting verification access:", error);
        //         });
        // },

        _onDetailApprovalStatRouteMatched: function (oEvent) {
            const sRequestId = oEvent.getParameter("arguments").RequestId;
            console.log("Route-matched Request ID:", sRequestId);

            if (!this._isValidGuid(sRequestId)) {
                console.error("Invalid Request ID format:", sRequestId);
                MessageBox.error("Invalid Request ID format");
                return;
            }

            this._oDetailApprovalStatModel.setProperty("/RequestId", sRequestId);
            this._oSelectedModel = this.getOwnerComponent().getModel("StatusChange");

            this._getDetailApprovalData(sRequestId);
            this.loadApprovalHistoryWithRequestor(sRequestId);

            const oUploadSet = this.byId("idUploadSet");
            if (oUploadSet) {
                oUploadSet.removeAllItems();
            }
            const oFileAttachmentModel = this.getView().getModel("fileAttachment");
            if (oFileAttachmentModel) {
                oFileAttachmentModel.setProperty("/results", []);
            }

            this._getDetailApprovalData(sRequestId).then(() => {
                this._updateDisposisiSelection();
            });

            this._currentUser(sRequestId)
            .then(() => {
                const oCurrentUserModel = this.getView().getModel("currentUser");
                const sEmployeeId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");
                const oButtonStateModel = this.getView().getModel("buttonState");

                this._oSelectedModel.read(`/RequestSet(guid'${sRequestId}')/toApproval`, {
                    success: (oData) => {
                        // Find all approval entries for the current user
                        const aUserApprovals = oData.results.filter(entry => entry.ApproverId === sEmployeeId);
                        // Get the latest approval entry (last in array)
                        const oLatestUserApproval = aUserApprovals.length > 0 ? aUserApprovals[aUserApprovals.length - 1] : null;

                        if (!oLatestUserApproval) {
                            oButtonStateModel.setProperty("/isApproveEnabled", false);
                            oButtonStateModel.setProperty("/isRejectEnabled", false);
                            oButtonStateModel.setProperty("/isReviseEnabled", false);
                            return;
                        }

                        const sStatus = oLatestUserApproval.Status; // e.g. "", "S", "A", "R", "V", "P"
                        console.log("DEBUG: Status =", sStatus);

                        // Enable buttons only if status is empty (not yet processed)
                        if (!sStatus) {
                            oButtonStateModel.setProperty("/isApproveEnabled", true);
                            oButtonStateModel.setProperty("/isRejectEnabled", true);
                            oButtonStateModel.setProperty("/isReviseEnabled", true);
                        } else {
                            oButtonStateModel.setProperty("/isApproveEnabled", false);
                            oButtonStateModel.setProperty("/isRejectEnabled", false);
                            oButtonStateModel.setProperty("/isReviseEnabled", false);
                        }
                    },
                    error: (oError) => {
                        oButtonStateModel.setProperty("/isApproveEnabled", false);
                        oButtonStateModel.setProperty("/isRejectEnabled", false);
                        oButtonStateModel.setProperty("/isReviseEnabled", false);
                    }
                });
            })
            .catch((error) => {
                console.error("Error setting verification access:", error);
            });
        },

        // _onDetailApprovalStatRouteMatched: function (oEvent) {
        //     const sRequestId = oEvent.getParameter("arguments").RequestId;
        //     console.log("Route-matched Request ID:", sRequestId);

        //     if (!this._isValidGuid(sRequestId)) {
        //         console.error("Invalid Request ID format:", sRequestId);
        //         MessageBox.error("Invalid Request ID format");
        //         return;
        //     }

        //     console.log("Valid Request ID:", sRequestId);

        //     // Set the RequestId in the detailApprovalModel
        //     this._oDetailApprovalStatModel.setProperty("/RequestId", sRequestId);

        //     // Always use the default model
        //     this._oSelectedModel = this.getOwnerComponent().getModel("StatusChange");

        //     // Fetch detail data, approval history, and current user info
        //     this._getDetailApprovalData(sRequestId);
        //     this.loadApprovalHistoryWithRequestor(sRequestId);

        //     // Clear upload set and file attachment model
        //     const oUploadSet = this.byId("idUploadSet");
        //     if (oUploadSet) {
        //         oUploadSet.removeAllItems();
        //     }
        //     const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     if (oFileAttachmentModel) {
        //         oFileAttachmentModel.setProperty("/results", []);
        //     }

        //     // Update disposisi selection after loading detail data
        //     this._getDetailApprovalData(sRequestId).then(() => {
        //         this._updateDisposisiSelection();
        //     });

        //     this._currentUser(sRequestId)
        //     .then(() => {
        //         const oCurrentUserModel = this.getView().getModel("currentUser");
        //         const sEmployeeId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");
        //         const oButtonStateModel = this.getView().getModel("buttonState");

        //         // Read /toApproval for this request
        //         this._oSelectedModel.read(`/RequestSet(guid'${sRequestId}')/toApproval`, {
        //             success: (oData) => {
        //                 // Find all approval entries for the current user
        //                 const aUserApprovals = oData.results.filter(entry => entry.ApproverId === sEmployeeId);
        //                 // Get the latest approval entry (last in array)
        //                 const oLatestUserApproval = aUserApprovals.length > 0 ? aUserApprovals[aUserApprovals.length - 1] : null;

        //                 if (!oLatestUserApproval) {
        //                     // No approval entry found for this user, disable all
        //                     oButtonStateModel.setProperty("/isApproveEnabled", false);
        //                     oButtonStateModel.setProperty("/isRejectEnabled", false);
        //                     oButtonStateModel.setProperty("/isReviseEnabled", false);
        //                     return;
        //                 }

        //                 const sStatus = oLatestUserApproval.Status; // e.g. "S", "A", "R", "V"
        //                 const sStat = oLatestUserApproval.Stat;     // e.g. "A1", "A2", etc.

        //                 console.log("DEBUG: Stat =", sStat, "Status =", sStatus);

        //                 // Enable buttons only if latest approval is not yet submitted
        //                 if (sStatus === "V" || sStatus === "A" || sStatus === "R" || sStatus === "P") {
        //                     oButtonStateModel.setProperty("/isApproveEnabled", false);
        //                     oButtonStateModel.setProperty("/isRejectEnabled", false);
        //                     oButtonStateModel.setProperty("/isReviseEnabled", false);
        //                 } else {
        //                     oButtonStateModel.setProperty("/isApproveEnabled", true);
        //                     oButtonStateModel.setProperty("/isRejectEnabled", true);
        //                     oButtonStateModel.setProperty("/isReviseEnabled", true);
        //                 }
        //             },
        //             error: (oError) => {
        //                 // On error, disable all
        //                 oButtonStateModel.setProperty("/isApproveEnabled", false);
        //                 oButtonStateModel.setProperty("/isRejectEnabled", false);
        //                 oButtonStateModel.setProperty("/isReviseEnabled", false);
        //             }
        //         });
        //     })
        //     .catch((error) => {
        //         console.error("Error setting verification access:", error);
        //     });
        // },

        _updateDisposisiSelection: function () {
            const sDisposisi = this._oDetailApprovalStatModel.getProperty("/Zdisposisi");
            const iSelectedIndex = sDisposisi === "1" ? 0 : 1; // Map "1" to the first button, otherwise the second
            this.getView().getModel("disposisiApprovalStat1").setProperty("/selectedIndex", iSelectedIndex);
        },

        _isValidGuid: function (sGuid) {
            var guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            return guidRegex.test(sGuid);
        },

        // _getDetailApprovalData: function (sRequestId) {
        //     if (!sRequestId || !this._isValidGuid(sRequestId)) {
        //         MessageBox.error("Invalid Request ID format. Cannot fetch details.");
        //         return;
        //     }

        //     const oModel = this.getOwnerComponent().getModel("StatusChange"); // Only use the default model
        //     this._oBusy.open();

        //     const sRequestPath = `/RequestSet(guid'${sRequestId}')`;

        //     return new Promise((resolve, reject) => {
        //         oModel.read(sRequestPath, {
        //             success: function (oRequestData) {
        //                 console.log("RequestSet data retrieved successfully:", oRequestData);

        //                 const sEmployeeNumber = oRequestData.EmployeeNumber;
        //                 const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;

        //                 oModel.read(sEmployeePath, {
        //                     success: function (oEmployeeData) {
        //                         console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);

        //                         const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                         oModel.read(sApprovalPath, {
        //                             success: function (oApprovalData) {
        //                                 console.log("Approval data retrieved successfully:", oApprovalData.results);

        //                                 const sAttachmentPath = `/FileAttachmentViewSet`;
        //                                 const aFilters = [
        //                                     new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
        //                                 ];
        //                                 oModel.read(sAttachmentPath, {
        //                                     filters: aFilters,
        //                                     success: function (oAttachmentData) {
        //                                         console.log("Attachment data retrieved successfully from FileAttachmentViewSet:", oAttachmentData.results);

        //                                         const aAttachments = oAttachmentData.results || [];
        //                                         if (aAttachments.length === 0) {
        //                                             console.log("No attachments found for the given RequestId.");
        //                                         }

        //                                         const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: aAttachments });
        //                                         this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");

        //                                         // Combine data from RequestSet, EmployeeDetailSet, toApproval, and FileAttachmentViewSet
        //                                         // const oCombinedData = Object.assign({}, oEmployeeData, oRequestData, {
        //                                         //     ApprovalHistory: oApprovalData.results,
        //                                         //     Attachments: aAttachments
        //                                         // });

        //                                         const oCombinedData = Object.assign({}, oEmployeeData, oRequestData, {
        //                                             EmployeeName: oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                             ApprovalHistory: oApprovalData.results,
        //                                             Attachments: aAttachments
        //                                         });

        //                                         // --- Custom logic for access control based on Massg ---
        //                                         const sReason = oRequestData.Massg; // 01, 02, 03, etc.
        //                                         const sBtrtlAsl = oRequestData.BtrtlAsl;
        //                                         const aApprovalHistory = oApprovalData.results || [];
        //                                         const oVerificationModel = this.getView().getModel("verificationModel");

        //                                         // Find first approval with Stat === "A1"
        //                                         const oFirstA1 = aApprovalHistory.find(item => item.Stat === "A1");

        //                                         // Get current user info
        //                                         const oCurrentUserModel = this.getView().getModel("currentUser");
        //                                         // const sCurrentUserStat = oCurrentUserModel && oCurrentUserModel.getProperty("/Stat");
        //                                         const sCurrentUserId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");

        //                                         // Find the latest approval entry for the current user
        //                                         const aUserApprovals = aApprovalHistory.filter(item => item.ApproverId === sCurrentUserId);
        //                                         const oLatestUserApproval = aUserApprovals.length > 0 ? aUserApprovals[aUserApprovals.length - 1] : null;
        //                                         const sCurrentUserStat = oLatestUserApproval ? oLatestUserApproval.Stat : (oCurrentUserModel && oCurrentUserModel.getProperty("/Stat"));

        //                                         // If reason is 01 or 02, give A1 access like A5
        //                                         if (
        //                                             (sReason === "01" || sReason === "02" || sReason === "03") &&
        //                                             oFirstA1 &&
        //                                             sCurrentUserStat === "A1" &&
        //                                             sCurrentUserId === oFirstA1.ApproverId
        //                                         ) {
        //                                             // Optionally, you can check if the current user is this A1 approver before giving access
        //                                             // if (this._sEmployeeId === oFirstA1.ApproverId) { ... }
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", true);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", true);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", true);
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", true);
        //                                             console.log("Access set for DM Staff (A1)");
        //                                         } else if (
        //                                             sReason === "01" &&
        //                                             sBtrtlAsl === "0000" &&
        //                                             sCurrentUserStat === "V1"
        //                                         ) {
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             console.log("Upload enabled for V1 because reason is 01");
        //                                         } 
        //                                         else {
        //                                             // For reason 03, first approval (A1) does NOT get disposisi access
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", false);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //                                             oVerificationModel.setProperty("/isUploadVisible", false);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //                                             console.log("Access for DM Staff (A1) is restricted");
        //                                         }
        //                                         // --- End custom logic ---

        //                                         this._oDetailApprovalStatModel.setData(oCombinedData);
        //                                         this.applyReasonVisibility(oCombinedData.Massg);

        //                                         // --- Custom: Disable Disposisi fields if reason is 03 ---
        //                                         if (oCombinedData.Massg === "03") {
        //                                             // Only enable rekomendasiHCMApprovalStat, disable others
        //                                             var oRekomInput = this.byId("rekomendasiHCMApprovalStat");
        //                                             var oDispoNote = this.byId("dispoNoteApprovalStat");
        //                                             var oGaji = this.byId("gajiApprovalStat");
        //                                             var oDisposisiRadio = this.byId("disposisiApprovalStat1");

        //                                             if (oRekomInput) oRekomInput.setEnabled(true);
        //                                             if (oDispoNote) oDispoNote.setEnabled(false);
        //                                             if (oGaji) oGaji.setEnabled(false);
        //                                             if (oDisposisiRadio) oDisposisiRadio.setEnabled(false);
        //                                         } else {
        //                                             // Enable all fields for other reasons
        //                                             var oRekomInput = this.byId("rekomendasiHCMApprovalStat");
        //                                             var oDispoNote = this.byId("dispoNoteApprovalStat");
        //                                             var oGaji = this.byId("gajiApprovalStat");
        //                                             var oDisposisiRadio = this.byId("disposisiApprovalStat1");

        //                                             if (oRekomInput) oRekomInput.setEnabled(true);
        //                                             if (oDispoNote) oDispoNote.setEnabled(true);
        //                                             if (oGaji) oGaji.setEnabled(true);
        //                                             if (oDisposisiRadio) oDisposisiRadio.setEnabled(true);
        //                                         }
                                                
        //                                         resolve(oCombinedData);
        //                                     }.bind(this),
        //                                     error: function (oError) {
        //                                         console.error("Error retrieving attachment data from FileAttachmentViewSet:", oError);
        //                                         reject(oError);
        //                                     }.bind(this)
        //                                 });
        //                             }.bind(this),
        //                             error: function (oError) {
        //                                 console.error("Error retrieving approval data:", oError);
        //                                 reject(oError);
        //                             }.bind(this)
        //                         });
        //                     }.bind(this),
        //                     error: function (oError) {
        //                         console.error("Error retrieving EmployeeDetailSet data:", oError);
        //                         reject(oError);
        //                     }.bind(this)
        //                 });
        //             }.bind(this),
        //             error: function (oError) {
        //                 console.error("Error retrieving RequestSet data:", oError);
        //                 if (oError.responseText) {
        //                     try {
        //                         const oErrorResponse = JSON.parse(oError.responseText);
        //                         console.error("Error details:", oErrorResponse.error.message.value);
        //                     } catch (e) {
        //                         console.error("Failed to parse error response:", e);
        //                     }
        //                 }
        //                 reject(oError);
        //             }.bind(this)
        //         });
        //     })
        //     .catch((oError) => {
        //         MessageBox.error("An unexpected error occurred while loading request data.");
        //     })
        //     .finally(() => {
        //         this._oBusy.close();
        //     });
        // },

        // bismillah fix 31/05
        // _getDetailApprovalData: function (sRequestId) {
        //     if (!sRequestId || !this._isValidGuid(sRequestId)) {
        //         MessageBox.error("Invalid Request ID format. Cannot fetch details.");
        //         return;
        //     }

        //     const oModel = this.getOwnerComponent().getModel("StatusChange");
        //     this._oBusy.open();

        //     const sRequestPath = `/RequestSet(guid'${sRequestId}')`;

        //     return new Promise((resolve, reject) => {
        //         oModel.read(sRequestPath, {
        //             success: function (oRequestData) {
        //                 const sEmployeeNumber = oRequestData.EmployeeNumber;
        //                 const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;

        //                 oModel.read(sEmployeePath, {
        //                     success: function (oEmployeeData) {
        //                         const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                         oModel.read(sApprovalPath, {
        //                             success: function (oApprovalData) {
        //                                 const sAttachmentPath = `/FileAttachmentViewSet`;
        //                                 const aFilters = [
        //                                     new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
        //                                 ];
        //                                 oModel.read(sAttachmentPath, {
        //                                     filters: aFilters,
        //                                     success: function (oAttachmentData) {
        //                                         const aAttachments = oAttachmentData.results || [];
        //                                         const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: aAttachments });
        //                                         this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");

        //                                         const oCombinedData = Object.assign({}, oEmployeeData, oRequestData, {
        //                                             EmployeeName: oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                             ApprovalHistory: oApprovalData.results,
        //                                             Attachments: aAttachments
        //                                         });

        //                                         // --- Custom logic for access control based on Massg ---
        //                                         const sReason = oRequestData.Massg;
        //                                         const sBtrtlAsl = oRequestData.BtrtlAsl;
        //                                         const aApprovalHistory = oApprovalData.results || [];
        //                                         const oVerificationModel = this.getView().getModel("verificationModel");

        //                                         // Get current user info
        //                                         const oCurrentUserModel = this.getView().getModel("currentUser");
        //                                         const sCurrentUserId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");

        //                                         // Find the latest approval entry for the current user
        //                                         const aUserApprovals = aApprovalHistory.filter(item => item.ApproverId === sCurrentUserId);
        //                                         const oLatestUserApproval = aUserApprovals.length > 0 ? aUserApprovals[aUserApprovals.length - 1] : null;
        //                                         const sCurrentUserStat = oLatestUserApproval ? oLatestUserApproval.Stat : (oCurrentUserModel && oCurrentUserModel.getProperty("/Stat"));

        //                                         // Find DM Staff approval entry based on reason
        //                                         let oDMStaffApproval = null;
        //                                         if (sReason === "03") {
        //                                             oDMStaffApproval = aApprovalHistory.find(item => item.Stat === "A1");
        //                                         } else if (sReason === "01" || sReason === "02") {
        //                                             oDMStaffApproval = aApprovalHistory.find(item => item.Stat === "A3");
        //                                         }

        //                                         // Set access for DM Staff based on new logic
        //                                         if (
        //                                             (sReason === "03" && oDMStaffApproval && sCurrentUserStat === "A1" && sCurrentUserId === oDMStaffApproval.ApproverId)
        //                                         ) {
        //                                             // Only enable rekomendasi, disable others and upload
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", true);
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //                                             oVerificationModel.setProperty("/isUploadVisible", false);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", true);
        //                                             console.log("Access set for DM Staff (A1 for 03): Only rekomendasi enabled");
        //                                         } else if (
        //                                             ((sReason === "01" || sReason === "02") && oDMStaffApproval && sCurrentUserStat === "A3" && sCurrentUserId === oDMStaffApproval.ApproverId)
        //                                         ) {
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", true);
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", true);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", true);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", true);
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", true);
        //                                             console.log("Access set for DM Staff (A3 for 01/02): All enabled");
        //                                         } else if (
        //                                             sReason === "01" &&
        //                                             sBtrtlAsl === "0000" &&
        //                                             sCurrentUserStat === "V1" &&
        //                                             oDMStaffApproval &&
        //                                             sCurrentUserId === oDMStaffApproval.ApproverId
        //                                         ) {
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", false);
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", true);
        //                                             console.log("Special: DM Staff (A3) with STAT V1 can only upload after A5 approval.");
        //                                         } else {
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", false);
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //                                             oVerificationModel.setProperty("/isUploadVisible", false);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", false);
        //                                             console.log("Access for DM Staff is restricted");
        //                                         }
        //                                         // --- End custom logic ---

        //                                         this._oDetailApprovalStatModel.setData(oCombinedData);
        //                                         this.applyReasonVisibility(oCombinedData.Massg);

        //                                         resolve(oCombinedData);
        //                                     }.bind(this),
        //                                     error: function (oError) {
        //                                         reject(oError);
        //                                     }.bind(this)
        //                                 });
        //                             }.bind(this),
        //                             error: function (oError) {
        //                                 reject(oError);
        //                             }.bind(this)
        //                         });
        //                     }.bind(this),
        //                     error: function (oError) {
        //                         reject(oError);
        //                     }.bind(this)
        //                 });
        //             }.bind(this),
        //             error: function (oError) {
        //                 reject(oError);
        //             }.bind(this)
        //         });
        //     })
        //     .catch((oError) => {
        //         MessageBox.error("An unexpected error occurred while loading request data.");
        //     })
        //     .finally(() => {
        //         this._oBusy.close();
        //     });
        // },

        _getDetailApprovalData: function (sRequestId) {
            if (!sRequestId || !this._isValidGuid(sRequestId)) {
                MessageBox.error("Invalid Request ID format. Cannot fetch details.");
                return;
            }
            const oModel = this.getOwnerComponent().getModel("StatusChange");
            this._oBusy.open();
            const sRequestPath = `/RequestSet(guid'${sRequestId}')`;

            return new Promise((resolve, reject) => {
                oModel.read(sRequestPath, {
                    success: function (oRequestData) {
                        const sEmployeeNumber = oRequestData.EmployeeNumber;
                        const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;

                        oModel.read(sEmployeePath, {
                            success: function (oEmployeeData) {
                                const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
                                oModel.read(sApprovalPath, {
                                    success: function (oApprovalData) {
                                        const sAttachmentPath = `/FileAttachmentViewSet`;
                                        const aFilters = [
                                            new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
                                        ];
                                        oModel.read(sAttachmentPath, {
                                            filters: aFilters,
                                            success: function (oAttachmentData) {
                                                const aAttachments = oAttachmentData.results || [];
                                                const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: aAttachments });
                                                this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");

                                                const oCombinedData = Object.assign({}, oEmployeeData, oRequestData, {
                                                    EmployeeName: oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || oRequestData.EmployeeName,
                                                    ApprovalHistory: oApprovalData.results,
                                                    Attachments: aAttachments
                                                });

                                                // --- Custom logic for access control based on Massg ---
                                                const sReason = oRequestData.Massg;
                                                const sBtrtlAsl = oRequestData.BtrtlAsl;
                                                const aApprovalHistory = oApprovalData.results || [];
                                                const oVerificationModel = this.getView().getModel("verificationModel");

                                                // Get current user info
                                                const oCurrentUserModel = this.getView().getModel("currentUser");
                                                const sCurrentUserId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");

                                                // Find the latest approval entry for the current user
                                                const aUserApprovals = aApprovalHistory.filter(item => item.ApproverId === sCurrentUserId);
                                                const oLatestUserApproval = aUserApprovals.length > 0 ? aUserApprovals[aUserApprovals.length - 1] : null;
                                                const sCurrentUserStat = oLatestUserApproval ? oLatestUserApproval.Stat : (oCurrentUserModel && oCurrentUserModel.getProperty("/Stat"));

                                                // Find DM Staff approval entry based on reason
                                                let oDMStaffApproval = null;
                                                if (sReason === "03") {
                                                    oDMStaffApproval = aApprovalHistory.find(item => item.Stat === "A1");
                                                } else if (sReason === "01" || sReason === "02") {
                                                    oDMStaffApproval = aApprovalHistory.find(item => item.Stat === "A3");
                                                }

                                                // Set access for DM Staff based on new logic
                                                if (
                                                    (sReason === "03" && oDMStaffApproval && sCurrentUserStat === "A1" && sCurrentUserId === oDMStaffApproval.ApproverId)
                                                ) {
                                                    // Only enable rekomendasi, disable others and upload
                                                    oVerificationModel.setProperty("/isRekomendasiEnabled", true);
                                                    oVerificationModel.setProperty("/isDisposisiEnabled", false);
                                                    oVerificationModel.setProperty("/isSalaryFinalEditable", false);
                                                    oVerificationModel.setProperty("/isDownloadEnabled", false);
                                                    oVerificationModel.setProperty("/isUploadVisible", false);
                                                    oVerificationModel.setProperty("/isSubmitVisible", true);
                                                    console.log("Access set for DM Staff (A1 for 03): Only rekomendasi enabled");
                                                } else if (
                                                    ((sReason === "01" || sReason === "02") && oDMStaffApproval && sCurrentUserStat === "A3" && sCurrentUserId === oDMStaffApproval.ApproverId)
                                                ) {
                                                    oVerificationModel.setProperty("/isRekomendasiEnabled", true);
                                                    oVerificationModel.setProperty("/isDisposisiEnabled", true);
                                                    oVerificationModel.setProperty("/isSalaryFinalEditable", true);
                                                    oVerificationModel.setProperty("/isDownloadEnabled", true);
                                                    oVerificationModel.setProperty("/isUploadVisible", true);
                                                    oVerificationModel.setProperty("/isSubmitVisible", true);
                                                    console.log("Access set for DM Staff (A3 for 01/02): All enabled");
                                                } else if (
                                                    sReason === "01" &&
                                                    sBtrtlAsl === "0000" &&
                                                    sCurrentUserStat === "V1" &&
                                                    oDMStaffApproval &&
                                                    sCurrentUserId === oDMStaffApproval.ApproverId
                                                ) {
                                                    oVerificationModel.setProperty("/isRekomendasiEnabled", false);
                                                    oVerificationModel.setProperty("/isDisposisiEnabled", false);
                                                    oVerificationModel.setProperty("/isSalaryFinalEditable", false);
                                                    oVerificationModel.setProperty("/isDownloadEnabled", false);
                                                    oVerificationModel.setProperty("/isUploadVisible", true);
                                                    oVerificationModel.setProperty("/isSubmitVisible", true);
                                                    console.log("Special: DM Staff (A3) with STAT V1 can only upload after A5 approval.");
                                                } else if (
                                                    sReason === "01" &&
                                                    sBtrtlAsl !== "0000" && // anything except 0000
                                                    sCurrentUserStat === "V0" && // V0
                                                    (!oDMStaffApproval || sCurrentUserId !== oDMStaffApproval.ApproverId) // not DM Staff
                                                ) {
                                                    oVerificationModel.setProperty("/isRekomendasiEnabled", false);
                                                    oVerificationModel.setProperty("/isDisposisiEnabled", false);
                                                    oVerificationModel.setProperty("/isSalaryFinalEditable", false);
                                                    oVerificationModel.setProperty("/isDownloadEnabled", false);
                                                    oVerificationModel.setProperty("/isUploadVisible", true);
                                                    oVerificationModel.setProperty("/isSubmitVisible", true);
                                                    console.log("Special: V0 user (not DM Staff), reason 01, btrtlAsl != 0000: Only upload/submit enabled");
                                                } else if (
                                                    sCurrentUserStat === "V1" &&
                                                    sReason === "01" &&
                                                    sBtrtlAsl !== "0000"
                                                ) {
                                                    // V1 user, reason 01, btrtlAsl is NOT 0000: only approve/reject/revise enabled, no upload, no disposisi
                                                    oVerificationModel.setProperty("/isRekomendasiEnabled", false);
                                                    oVerificationModel.setProperty("/isDisposisiEnabled", false);
                                                    oVerificationModel.setProperty("/isSalaryFinalEditable", false);
                                                    oVerificationModel.setProperty("/isDownloadEnabled", false);
                                                    oVerificationModel.setProperty("/isUploadVisible", false);
                                                    oVerificationModel.setProperty("/isSubmitVisible", false);
                                                    console.log("V1 user (not 0000): Only approve/reject/revise enabled, no upload/disposisi");
                                                } else {
                                                    oVerificationModel.setProperty("/isRekomendasiEnabled", false);
                                                    oVerificationModel.setProperty("/isDisposisiEnabled", false);
                                                    oVerificationModel.setProperty("/isSalaryFinalEditable", false);
                                                    oVerificationModel.setProperty("/isDownloadEnabled", false);
                                                    oVerificationModel.setProperty("/isUploadVisible", false);
                                                    oVerificationModel.setProperty("/isSubmitVisible", false);
                                                    console.log("Access for DM Staff is restricted");
                                                }
                                                // --- End custom logic ---

                                                // Set active approval entry for button enable/disable logic
                                                let oActiveApprovalEntry = null;
                                                if (aUserApprovals.length > 0) {
                                                    oActiveApprovalEntry = aUserApprovals.find(entry => !entry.Status) || null;
                                                }
                                                this._oDetailApprovalStatModel.setProperty("/activeApprovalEntry", oActiveApprovalEntry);
                                                console.log("Active Approval Entry:", oActiveApprovalEntry);

                                                this._oDetailApprovalStatModel.setData(oCombinedData);
                                                this.applyReasonVisibility(oCombinedData.Massg);

                                                resolve(oCombinedData);
                                            }.bind(this),
                                            error: function (oError) {
                                                reject(oError);
                                            }.bind(this)
                                        });
                                    }.bind(this),
                                    error: function (oError) {
                                        reject(oError);
                                    }.bind(this)
                                });
                            }.bind(this),
                            error: function (oError) {
                                reject(oError);
                            }.bind(this)
                        });
                    }.bind(this),
                    error: function (oError) {
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

        // _getDetailApprovalData: function (sRequestId) {
        //     if (!sRequestId || !this._isValidGuid(sRequestId)) {
        //         MessageBox.error("Invalid Request ID format. Cannot fetch details.");
        //         return;
        //     }
        //     const oModel = this.getOwnerComponent().getModel("StatusChange");
        //     this._oBusy.open();
        //     const sRequestPath = `/RequestSet(guid'${sRequestId}')`;

        //     return new Promise((resolve, reject) => {
        //         oModel.read(sRequestPath, {
        //             success: function (oRequestData) {
        //                 const sEmployeeNumber = oRequestData.EmployeeNumber;
        //                 const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;

        //                 oModel.read(sEmployeePath, {
        //                     success: function (oEmployeeData) {
        //                         const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                         oModel.read(sApprovalPath, {
        //                             success: function (oApprovalData) {
        //                                 const sAttachmentPath = `/FileAttachmentViewSet`;
        //                                 const aFilters = [
        //                                     new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
        //                                 ];
        //                                 oModel.read(sAttachmentPath, {
        //                                     filters: aFilters,
        //                                     success: function (oAttachmentData) {
        //                                         const aAttachments = oAttachmentData.results || [];
        //                                         const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: aAttachments });
        //                                         this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");

        //                                         const oCombinedData = Object.assign({}, oEmployeeData, oRequestData, {
        //                                             EmployeeName: oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                             ApprovalHistory: oApprovalData.results,
        //                                             Attachments: aAttachments
        //                                         });

        //                                         // Get current user info
        //                                         const oCurrentUserModel = this.getView().getModel("currentUser");
        //                                         const sCurrentUserId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");
        //                                         const aUserApprovals = oApprovalData.results.filter(item => item.ApproverId === sCurrentUserId);
        //                                         const oActiveApprovalEntry = aUserApprovals.find(entry => !entry.Status) || null;
        //                                         this._oDetailApprovalStatModel.setProperty("/activeApprovalEntry", oActiveApprovalEntry);

        //                                         this._oDetailApprovalStatModel.setData(oCombinedData);
        //                                         this.applyReasonVisibility(oCombinedData.Massg);

        //                                         resolve(oCombinedData);
        //                                     }.bind(this),
        //                                     error: function (oError) {
        //                                         reject(oError);
        //                                     }.bind(this)
        //                                 });
        //                             }.bind(this),
        //                             error: function (oError) {
        //                                 reject(oError);
        //                             }.bind(this)
        //                         });
        //                     }.bind(this),
        //                     error: function (oError) {
        //                         reject(oError);
        //                     }.bind(this)
        //                 });
        //             }.bind(this),
        //             error: function (oError) {
        //                 reject(oError);
        //             }.bind(this)
        //         });
        //     })
        //     .catch((oError) => {
        //         MessageBox.error("An unexpected error occurred while loading request data.");
        //     })
        //     .finally(() => {
        //         this._oBusy.close();
        //     });
        // },

        // fix
        // _getDetailApprovalData: function (sRequestId) {
        //     if (!sRequestId || !this._isValidGuid(sRequestId)) {
        //         MessageBox.error("Invalid Request ID format. Cannot fetch details.");
        //         return;
        //     }

        //     const oModel = this.getOwnerComponent().getModel("StatusChange");
        //     this._oBusy.open();

        //     const sRequestPath = `/RequestSet(guid'${sRequestId}')`;

        //     return new Promise((resolve, reject) => {
        //         oModel.read(sRequestPath, {
        //             success: function (oRequestData) {
        //                 const sEmployeeNumber = oRequestData.EmployeeNumber;
        //                 const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;

        //                 oModel.read(sEmployeePath, {
        //                     success: function (oEmployeeData) {
        //                         const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                         oModel.read(sApprovalPath, {
        //                             success: function (oApprovalData) {
        //                                 const sAttachmentPath = `/FileAttachmentViewSet`;
        //                                 const aFilters = [
        //                                     new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
        //                                 ];
        //                                 oModel.read(sAttachmentPath, {
        //                                     filters: aFilters,
        //                                     success: function (oAttachmentData) {
        //                                         const aAttachments = oAttachmentData.results || [];
        //                                         const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: aAttachments });
        //                                         this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");

        //                                         const oCombinedData = Object.assign({}, oEmployeeData, oRequestData, {
        //                                             EmployeeName: oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                             ApprovalHistory: oApprovalData.results,
        //                                             Attachments: aAttachments
        //                                         });

        //                                         // --- Custom logic for access control based on Massg ---
        //                                         const sReason = oRequestData.Massg;
        //                                         const sBtrtlAsl = oRequestData.BtrtlAsl;
        //                                         const aApprovalHistory = oApprovalData.results || [];
        //                                         const oVerificationModel = this.getView().getModel("verificationModel");

        //                                         // Get current user info
        //                                         const oCurrentUserModel = this.getView().getModel("currentUser");
        //                                         const sCurrentUserId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");

        //                                         // Find the latest approval entry for the current user
        //                                         const aUserApprovals = aApprovalHistory.filter(item => item.ApproverId === sCurrentUserId);
        //                                         const oLatestUserApproval = aUserApprovals.length > 0 ? aUserApprovals[aUserApprovals.length - 1] : null;
        //                                         const sCurrentUserStat = oLatestUserApproval ? oLatestUserApproval.Stat : (oCurrentUserModel && oCurrentUserModel.getProperty("/Stat"));

        //                                         // Find DM Staff approval entry based on reason
        //                                         let oDMStaffApproval = null;
        //                                         if (sReason === "03") {
        //                                             oDMStaffApproval = aApprovalHistory.find(item => item.Stat === "A1");
        //                                         } else if (sReason === "01" || sReason === "02") {
        //                                             oDMStaffApproval = aApprovalHistory.find(item => item.Stat === "A3");
        //                                         }

        //                                         // Set access for DM Staff based on new logic
        //                                         if (
        //                                             (sReason === "03" && oDMStaffApproval && sCurrentUserStat === "A1" && sCurrentUserId === oDMStaffApproval.ApproverId)
        //                                         ) {
        //                                             // Only enable rekomendasi, disable others and upload
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", true);
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //                                             oVerificationModel.setProperty("/isUploadVisible", false);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", true);
        //                                             console.log("Access set for DM Staff (A1 for 03): Only rekomendasi enabled");
        //                                         } else if (
        //                                             ((sReason === "01" || sReason === "02") && oDMStaffApproval && sCurrentUserStat === "A3" && sCurrentUserId === oDMStaffApproval.ApproverId)
        //                                         ) {
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", true);
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", true);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", true);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", true);
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", true);
        //                                             console.log("Access set for DM Staff (A3 for 01/02): All enabled");
        //                                         } else if (
        //                                             sReason === "01" &&
        //                                             sBtrtlAsl === "0000" &&
        //                                             sCurrentUserStat === "V1" &&
        //                                             oDMStaffApproval &&
        //                                             sCurrentUserId === oDMStaffApproval.ApproverId
        //                                         ) {
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", false);
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", true);
        //                                             console.log("Special: DM Staff (A3) with STAT V1 can only upload after A5 approval.");
        //                                         } else {
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", false);
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //                                             oVerificationModel.setProperty("/isUploadVisible", false);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", false);
        //                                             console.log("Access for DM Staff is restricted");
        //                                         }
        //                                         // --- End custom logic ---

        //                                         // Set active approval entry for button enable/disable logic
        //                                         let oActiveApprovalEntry = null;
        //                                         if (aUserApprovals.length > 0) {
        //                                             oActiveApprovalEntry = aUserApprovals.find(entry => !entry.Status) || null;
        //                                         }
        //                                         this._oDetailApprovalStatModel.setProperty("/activeApprovalEntry", oActiveApprovalEntry);

        //                                         this._oDetailApprovalStatModel.setData(oCombinedData);
        //                                         this.applyReasonVisibility(oCombinedData.Massg);

        //                                         resolve(oCombinedData);
        //                                     }.bind(this),
        //                                     error: function (oError) {
        //                                         reject(oError);
        //                                     }.bind(this)
        //                                 });
        //                             }.bind(this),
        //                             error: function (oError) {
        //                                 reject(oError);
        //                             }.bind(this)
        //                         });
        //                     }.bind(this),
        //                     error: function (oError) {
        //                         reject(oError);
        //                     }.bind(this)
        //                 });
        //             }.bind(this),
        //             error: function (oError) {
        //                 reject(oError);
        //             }.bind(this)
        //         });
        //     })
        //     .catch((oError) => {
        //         MessageBox.error("An unexpected error occurred while loading request data.");
        //     })
        //     .finally(() => {
        //         this._oBusy.close();
        //     });
        // },

        // set access for dm staff
        // _getDetailApprovalData: function (sRequestId) {
        //     if (!sRequestId || !this._isValidGuid(sRequestId)) {
        //         MessageBox.error("Invalid Request ID format. Cannot fetch details.");
        //         return;
        //     }

        //     const oModel = this.getOwnerComponent().getModel("StatusChange");
        //     this._oBusy.open();

        //     const sRequestPath = `/RequestSet(guid'${sRequestId}')`;

        //     return new Promise((resolve, reject) => {
        //         oModel.read(sRequestPath, {
        //             success: function (oRequestData) {
        //                 const sEmployeeNumber = oRequestData.EmployeeNumber;
        //                 const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;

        //                 oModel.read(sEmployeePath, {
        //                     success: function (oEmployeeData) {
        //                         const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                         oModel.read(sApprovalPath, {
        //                             success: function (oApprovalData) {
        //                                 const sAttachmentPath = `/FileAttachmentViewSet`;
        //                                 const aFilters = [
        //                                     new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
        //                                 ];
        //                                 oModel.read(sAttachmentPath, {
        //                                     filters: aFilters,
        //                                     success: function (oAttachmentData) {
        //                                         const aAttachments = oAttachmentData.results || [];
        //                                         const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: aAttachments });
        //                                         this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");

        //                                         const oCombinedData = Object.assign({}, oEmployeeData, oRequestData, {
        //                                             EmployeeName: oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                             ApprovalHistory: oApprovalData.results,
        //                                             Attachments: aAttachments
        //                                         });

        //                                         // --- Custom logic for access control based on Massg ---
        //                                         const sReason = oRequestData.Massg;
        //                                         const sBtrtlAsl = oRequestData.BtrtlAsl;
        //                                         const aApprovalHistory = oApprovalData.results || [];
        //                                         const oVerificationModel = this.getView().getModel("verificationModel");

        //                                         // Get current user info
        //                                         const oCurrentUserModel = this.getView().getModel("currentUser");
        //                                         const sCurrentUserId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");

        //                                         // Find the latest approval entry for the current user
        //                                         const aUserApprovals = aApprovalHistory.filter(item => item.ApproverId === sCurrentUserId);
        //                                         const oLatestUserApproval = aUserApprovals.length > 0 ? aUserApprovals[aUserApprovals.length - 1] : null;
        //                                         const sCurrentUserStat = oLatestUserApproval ? oLatestUserApproval.Stat : (oCurrentUserModel && oCurrentUserModel.getProperty("/Stat"));

        //                                         // Find DM Staff approval entry based on reason
        //                                         let oDMStaffApproval = null;
        //                                         if (sReason === "03") {
        //                                             oDMStaffApproval = aApprovalHistory.find(item => item.Stat === "A1");
        //                                         } else if (sReason === "01" || sReason === "02") {
        //                                             oDMStaffApproval = aApprovalHistory.find(item => item.Stat === "A3");
        //                                         }

        //                                         // Set access for DM Staff based on new logic
        //                                         if (
        //                                             ((sReason === "01" || sReason === "02") && oDMStaffApproval && sCurrentUserStat === "A3" && sCurrentUserId === oDMStaffApproval.ApproverId) ||
        //                                             (sReason === "03" && oDMStaffApproval && sCurrentUserStat === "A1" && sCurrentUserId === oDMStaffApproval.ApproverId)
        //                                         ) {
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", true);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", true);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", true);
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", true);
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", true);
        //                                             console.log("Access set for DM Staff (A3 for 01/02, A1 for 03)");
        //                                         } else if (
        //                                             sReason === "01" &&
        //                                             sBtrtlAsl === "0000" &&
        //                                             sCurrentUserStat === "V1"
        //                                         ) {
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             console.log("Upload enabled for V1 because reason is 01");
        //                                         } else {
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", false);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //                                             oVerificationModel.setProperty("/isUploadVisible", false);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", false);
        //                                             console.log("Access for DM Staff is restricted");
        //                                         }
        //                                         // --- End custom logic ---

        //                                         this._oDetailApprovalStatModel.setData(oCombinedData);
        //                                         this.applyReasonVisibility(oCombinedData.Massg);

        //                                         resolve(oCombinedData);
        //                                     }.bind(this),
        //                                     error: function (oError) {
        //                                         reject(oError);
        //                                     }.bind(this)
        //                                 });
        //                             }.bind(this),
        //                             error: function (oError) {
        //                                 reject(oError);
        //                             }.bind(this)
        //                         });
        //                     }.bind(this),
        //                     error: function (oError) {
        //                         reject(oError);
        //                     }.bind(this)
        //                 });
        //             }.bind(this),
        //             error: function (oError) {
        //                 reject(oError);
        //             }.bind(this)
        //         });
        //     })
        //     .catch((oError) => {
        //         MessageBox.error("An unexpected error occurred while loading request data.");
        //     })
        //     .finally(() => {
        //         this._oBusy.close();
        //     });
        // },

        // _getDetailApprovalData: function (sRequestId) {
        //     if (!sRequestId || !this._isValidGuid(sRequestId)) {
        //         MessageBox.error("Invalid Request ID format. Cannot fetch details.");
        //         return;
        //     }

        //     const oModel = this.getOwnerComponent().getModel("StatusChange");
        //     this._oBusy.open();

        //     const sRequestPath = `/RequestSet(guid'${sRequestId}')`;

        //     return new Promise((resolve, reject) => {
        //         oModel.read(sRequestPath, {
        //             success: function (oRequestData) {
        //                 console.log("RequestSet data retrieved successfully:", oRequestData);

        //                 const sEmployeeNumber = oRequestData.EmployeeNumber;
        //                 const sEmployeePath = `/EmployeeDetailSet('${sEmployeeNumber}')`;

        //                 oModel.read(sEmployeePath, {
        //                     success: function (oEmployeeData) {
        //                         console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);

        //                         const sApprovalPath = `/RequestSet(guid'${sRequestId}')/toApproval`;
        //                         oModel.read(sApprovalPath, {
        //                             success: function (oApprovalData) {
        //                                 console.log("Approval data retrieved successfully:", oApprovalData.results);

        //                                 const sAttachmentPath = `/FileAttachmentViewSet`;
        //                                 const aFilters = [
        //                                     new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
        //                                 ];
        //                                 oModel.read(sAttachmentPath, {
        //                                     filters: aFilters,
        //                                     success: function (oAttachmentData) {
        //                                         console.log("Attachment data retrieved successfully from FileAttachmentViewSet:", oAttachmentData.results);

        //                                         const aAttachments = oAttachmentData.results || [];
        //                                         if (aAttachments.length === 0) {
        //                                             console.log("No attachments found for the given RequestId.");
        //                                         }

        //                                         const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: aAttachments });
        //                                         this.getView().setModel(oFileAttachmentModel, "fileAttachmentView");

        //                                         const oCombinedData = Object.assign({}, oEmployeeData, oRequestData, {
        //                                             EmployeeName: oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                                             ApprovalHistory: oApprovalData.results,
        //                                             Attachments: aAttachments
        //                                         });

        //                                         // --- Custom logic for access control based on Massg ---
        //                                         const sReason = oRequestData.Massg;
        //                                         const sBtrtlAsl = oRequestData.BtrtlAsl;
        //                                         const aApprovalHistory = oApprovalData.results || [];
        //                                         const oVerificationModel = this.getView().getModel("verificationModel");

        //                                         // Find first approval with Stat === "A1"
        //                                         const oFirstA1 = aApprovalHistory.find(item => item.Stat === "A1");

        //                                         // Get current user info
        //                                         const oCurrentUserModel = this.getView().getModel("currentUser");
        //                                         const sCurrentUserId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");

        //                                         // Find the latest approval entry for the current user
        //                                         const aUserApprovals = aApprovalHistory.filter(item => item.ApproverId === sCurrentUserId);
        //                                         const oLatestUserApproval = aUserApprovals.length > 0 ? aUserApprovals[aUserApprovals.length - 1] : null;
        //                                         const sCurrentUserStat = oLatestUserApproval ? oLatestUserApproval.Stat : (oCurrentUserModel && oCurrentUserModel.getProperty("/Stat"));

        //                                         // If reason is 01, 02, or 03 and current user is A1, enable all disposisi fields
        //                                         if (
        //                                             (sReason === "01" || sReason === "02" || sReason === "03") &&
        //                                             oFirstA1 &&
        //                                             sCurrentUserStat === "A1" &&
        //                                             sCurrentUserId === oFirstA1.ApproverId
        //                                         ) {
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", true);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", true);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", true);
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", true);
        //                                             console.log("Access set for DM Staff (A1)");
        //                                         } else if (
        //                                             sReason === "01" &&
        //                                             sBtrtlAsl === "0000" &&
        //                                             sCurrentUserStat === "V1"
        //                                         ) {
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             console.log("Upload enabled for V1 because reason is 01");
        //                                         } else {
        //                                             // For reason 03, first approval (A1) does NOT get disposisi access
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", false);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //                                             oVerificationModel.setProperty("/isUploadVisible", false);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //                                             console.log("Access for DM Staff (A1) is restricted");
        //                                         }
        //                                         // --- End custom logic ---

        //                                         this._oDetailApprovalStatModel.setData(oCombinedData);
        //                                         this.applyReasonVisibility(oCombinedData.Massg);

        //                                         if (oCombinedData.Massg === "03") {
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", true);
        //                                             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //                                             oVerificationModel.setProperty("/isSubmitVisible", false);
        //                                             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //                                             oVerificationModel.setProperty("/isUploadVisible", true);
        //                                             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //                                         } else {
        //                                             oVerificationModel.setProperty("/isRekomendasiEnabled", oVerificationModel.getProperty("/isDisposisiEnabled"));
        //                                         }
        //                                         // --- Custom: Disable Disposisi fields if reason is 03 ---
        //                                         // if (oCombinedData.Massg === "03") {
        //                                         //     // Only enable rekomendasiHCMApprovalStat, disable others
        //                                         //     var oRekomInput = this.byId("rekomendasiHCMApprovalStat");
        //                                         //     var oDispoNote = this.byId("dispoNoteApprovalStat");
        //                                         //     var oGaji = this.byId("gajiApprovalStat");
        //                                         //     var oDisposisiRadio = this.byId("disposisiApprovalStat1");

        //                                         //     if (oRekomInput) oRekomInput.setEnabled(true);
        //                                         //     if (oDispoNote) oDispoNote.setEnabled(false);
        //                                         //     if (oGaji) oGaji.setEnabled(false);
        //                                         //     if (oDisposisiRadio) oDisposisiRadio.setEnabled(false);
        //                                         // } else {
        //                                         //     // Enable all fields for other reasons
        //                                         //     var oRekomInput = this.byId("rekomendasiHCMApprovalStat");
        //                                         //     var oDispoNote = this.byId("dispoNoteApprovalStat");
        //                                         //     var oGaji = this.byId("gajiApprovalStat");
        //                                         //     var oDisposisiRadio = this.byId("disposisiApprovalStat1");

        //                                         //     if (oRekomInput) oRekomInput.setEnabled(true);
        //                                         //     if (oDispoNote) oDispoNote.setEnabled(true);
        //                                         //     if (oGaji) oGaji.setEnabled(true);
        //                                         //     if (oDisposisiRadio) oDisposisiRadio.setEnabled(true);
        //                                         // }

        //                                         resolve(oCombinedData);
        //                                     }.bind(this),
        //                                     error: function (oError) {
        //                                         console.error("Error retrieving attachment data from FileAttachmentViewSet:", oError);
        //                                         reject(oError);
        //                                     }.bind(this)
        //                                 });
        //                             }.bind(this),
        //                             error: function (oError) {
        //                                 console.error("Error retrieving approval data:", oError);
        //                                 reject(oError);
        //                             }.bind(this)
        //                         });
        //                     }.bind(this),
        //                     error: function (oError) {
        //                         console.error("Error retrieving EmployeeDetailSet data:", oError);
        //                         reject(oError);
        //                     }.bind(this)
        //                 });
        //             }.bind(this),
        //             error: function (oError) {
        //                 console.error("Error retrieving RequestSet data:", oError);
        //                 if (oError.responseText) {
        //                     try {
        //                         const oErrorResponse = JSON.parse(oError.responseText);
        //                         console.error("Error details:", oErrorResponse.error.message.value);
        //                     } catch (e) {
        //                         console.error("Failed to parse error response:", e);
        //                     }
        //                 }
        //                 reject(oError);
        //             }.bind(this)
        //         });
        //     })
        //     .catch((oError) => {
        //         MessageBox.error("An unexpected error occurred while loading request data.");
        //     })
        //     .finally(() => {
        //         this._oBusy.close();
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
            // var oCurrentUserModel = this.getView().getModel("currentUser");
            var oActiveApprovalEntry = this.getView().getModel("detailApprovalStatModel").getProperty("/activeApprovalEntry");
            var sStat = oActiveApprovalEntry && oActiveApprovalEntry.Stat;
            var sReason = this._oDetailApprovalStatModel.getProperty("/Massg");

            if (sStat === "A1" && sReason === "03" ) {
                if (!this._validateA1Submission()) {
                    return;
                }
            }

            if (sStat === "A3" && (sReason === "01" || sReason === "02")) {
                if (!this._validateA3Submission()) {
                    return;
                }
            }

            // DM Staff V1 (special: only require upload document)
            if (sStat === "V1") {
                if (!this._validateA3Submission()) {
                    return;
                }
            }
            this._openApprovalDialog("approve");
        },

        // onApprovePress: function () {
        //     var oCurrentUserModel = this.getView().getModel("currentUser");
        //     var sStat = oCurrentUserModel && oCurrentUserModel.getProperty("/Stat");
        //     var sReason = this._oDetailApprovalStatModel.getProperty("/Massg");

        //     // DM Staff validation: A1 for reason 03, A3 for reason 01/02
        //     if (
        //         (sReason === "03" && sStat === "A1") ||
        //         ((sReason === "01" || sReason === "02") && sStat === "A3")
        //     ) {
        //         if (!this._validateA1Submission()) {
        //             return;
        //         }
        //     }
        //     this._openApprovalDialog("approve");
        // },

        onRejectPress: function () {
            var oCurrentUserModel = this.getView().getModel("currentUser");
            var sStat = oCurrentUserModel && oCurrentUserModel.getProperty("/Stat");

            // if (sStat === "A1") {
            //     if (!this._validateA1Submission()) {
            //         return;
            //     }
            // }
            this._openApprovalDialog("reject");
        },

        // onApprovePress: function () {
        //     this._openApprovalDialog("approve");
        
        //     const oButtonStateModel = this.getView().getModel("buttonState");
        //     oButtonStateModel.setProperty("/isApproveEnabled", false);
        //     oButtonStateModel.setProperty("/isRejectEnabled", false);
        //     oButtonStateModel.setProperty("/isReviseEnabled", false);
        // },

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
                                        this._oDetailApprovalStatModel.setProperty("/RequestId", sRequestId); // Update the model
                                    }
                                }
        
                                // Combine the STAT field with the current user data
                                oCurrentUser.Stat = this._sUserStat; // Add STAT to the current user object
                                const oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
                                this.getView().setModel(oCurrentUserModel, "currentUser");
                                // this._setVerificationAccess();
        
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
            const oModel = this.getView().getModel("StatusChange"); // Get the OData model
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
                                        return entry.Status === "A" || entry.Status === "R" || entry.Status === "P";
                                    });
        
                                    const aApprovalHistory = [oRequestorEntry].concat(aFilteredApprovalData);
        
                                    const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: aApprovalHistory });
        
                                    this.getView().byId("idApprTable").setModel(oApprovalHistoryModel, "appr");
        
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
            const sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
            const sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
            const sRequestId = this._oDetailApprovalStatModel.getProperty("/RequestId");

            if (!sRequestId) {
                MessageBox.error("Request ID is missing. Cannot proceed with submission.");
                return;
            }
            if (!this._oSelectedModel) {
                MessageBox.error("System error: No OData model selected for submission.");
                return;
            }

            // Find the approval entry with empty Status for the current user
            const oCurrentUserModel = this.getView().getModel("currentUser");
            const sCurrentUserId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");

            this._oSelectedModel.read(`/RequestSet(guid'${sRequestId}')/toApproval`, {
                success: (oData) => {
                    // Find the approval entry with empty Status for the current user
                    const oApprovalToUpdate = oData.results.find(entry =>
                        entry.ApproverId === sCurrentUserId && !entry.Status
                    );

                    if (!oApprovalToUpdate) {
                        MessageBox.error("No active approval entry found for this user.");
                        return;
                    }

                    const oDateTime = this._createApprovalDateTime();
                    const oApprovalData = {
                        SequenceNumber: oApprovalToUpdate.SequenceNumber,
                        Stat: oApprovalToUpdate.Stat,
                        ObjectType: oApprovalToUpdate.ObjectType,
                        ApproverId: oApprovalToUpdate.ApproverId,
                        Abbreviation: oApprovalToUpdate.Abbreviation,
                        Status: sAction === "approve" ? "A" : "R",
                        StatusText: sAction === "approve" ? "Approved" : "Rejected",
                        ApprovalUser: oApprovalToUpdate.ApproverId,
                        Notes: sNotes,
                        ApprovalDate: oDateTime.ApprovalDate,
                        ApprovalTime: oDateTime.ApprovalTime
                    };

                    // Add additional fields if needed (example for A1)
                    const sReason = this._oDetailApprovalStatModel.getProperty("/Massg");
                    if (oApprovalToUpdate.Stat === "A1" && sReason === "03") {
                        // Only rekomendasiHCMApprovalStat is allowed
                        const sRekomHcm = this.byId("rekomendasiHCMApprovalStat").getValue();
                        oApprovalData.ZrekomHcm = sRekomHcm;
                    } else if (oApprovalToUpdate.Stat === "A3" && (sReason === "01" || sReason === "02")) {
                        // All fields are required for A3 with reason 01 or 02
                        const sRekomHcm = this.byId("rekomendasiHCMApprovalStat").getValue();
                        const sDispoNote = this.byId("dispoNoteApprovalStat").getValue();
                        const sSalaryFnl = this.byId("gajiApprovalStat").getValue() ? this.byId("gajiApprovalStat").getValue().replace(/\D/g, '') : "0";
                        const oDisposisiRadioGroup = this.byId("disposisiApprovalStat1");
                        const iDisposisiIndex = oDisposisiRadioGroup ? oDisposisiRadioGroup.getSelectedIndex() : -1;

                        oApprovalData.ZrekomHcm = sRekomHcm;
                        oApprovalData.Zdisposisi = (iDisposisiIndex + 1).toString();
                        oApprovalData.Znotedisp = sDispoNote;
                        oApprovalData.Zsalaryfnl = sSalaryFnl;
                    }

                    // Update the approval entry using its composite key
                    this._oSelectedModel.update(
                        `/RequestSet(guid'${sRequestId}')`,
                        oApprovalData,
                        {
                            method: "MERGE",
                            success: () => {
                                this._disableApprovalButtons();
                                MessageBox.success("Data berhasil disetujui.", {
                                    onClose: () => {
                                        this._oApprovalDialog.close();
                                        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                                        oRouter.navTo("approval", {}, true);
                                    }
                                });
                                this.onSubmitFiles(sRequestId);
                            },
                            error: (oError) => {
                                MessageBox.error("Failed to submit approval.");
                            }
                        }
                    );
                },
                error: (oError) => {
                    MessageBox.error("Failed to load approval data.");
                }
            });
        },

        // onSubmitApproval: function () {
        //     const sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
        //     const sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
        //     const sRequestId = this._oDetailApprovalStatModel.getProperty("/RequestId");

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

        //                     if (
        //                         oMatchedApproval.ApproverName &&
        //                         oMatchedApproval.ApproverName.FormattedName !== oCurrentUser.EmployeeName.FormattedName
        //                     ) {
        //                         console.warn("ApproverName mismatch. Using fallback to correct it.");
        //                         oMatchedApproval.ApproverName = oCurrentUser.EmployeeName;
        //                     }

        //                     console.log("Matched approval entry:", oMatchedApproval);

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

        //                     // Get reason for action (Massg) from detail model
        //                     const sReason = this._oDetailApprovalStatModel.getProperty("/Massg");

        //                     // Handle additional fields based on STAT
        //                     if (oMatchedApproval.Stat === "A1" && (sReason === "01" || sReason === "02")) {
        //                         const sRekomHcm = this.byId("rekomendasiHCMApprovalStat").getValue();
        //                         const sDispoNote = this.byId("dispoNoteApprovalStat").getValue();
        //                         const sSalaryFnl = this.byId("gajiApprovalStat").getValue() ? this.byId("gajiApprovalStat").getValue().replace(/\D/g, '') : "0";
        //                         const oDisposisiRadioGroup = this.byId("disposisiApprovalStat1");
        //                         const iDisposisiIndex = oDisposisiRadioGroup ? oDisposisiRadioGroup.getSelectedIndex() : -1;

        //                         oApprovalData.ZrekomHcm = sRekomHcm;
        //                         oApprovalData.Zdisposisi = (iDisposisiIndex + 1).toString();
        //                         oApprovalData.Znotedisp = sDispoNote;
        //                         oApprovalData.Zsalaryfnl = sSalaryFnl;
        //                     }
        //                     // Add more STAT-specific logic here if needed
        //                     // else if (oMatchedApproval.Stat === "A5") { ... }
        //                     // else if (oMatchedApproval.Stat === "VT") { ... }
        //                     // else if (oMatchedApproval.Stat === "VC") { ... }

        //                     console.log("Payload for submission:", oApprovalData);

        //                     // Submit the approval data
        //                     this._oSelectedModel.update(`/RequestSet(guid'${sRequestId}')`, oApprovalData, {
        //                         method: "MERGE",
        //                         success: () => {
        //                             this._disableApprovalButtons();

        //                             MessageBox.success("Data berhasil disetujui.", {
        //                                 onClose: () => {
        //                                     this._oApprovalDialog.close();
        //                                     var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //                                     oRouter.navTo("approval", {}, true);
        //                                 }
        //                             });
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

        applyReasonVisibility: function(sReasonKey) {
            // Homebase Tujuan fields
            var oHomebaseTujuanLabel = this.byId("homebaseTujuanLabel");
            var oHomebaseTujuan = this.byId("homebaseTujuanStatusChange");
            var oHomebaseTujuanText = this.byId("homebaseTujuanTextStatusChange");
            var oHomebaseAsal = this.byId("homebaseAsalStatusChange");
            var oHomebaseAsalText = this.byId("homebaseAsalTextStatusChange");

            // Kontrak fields
            var oKontrakStatusChange = this.byId("KontrakStatusChange");
            var oKontrakText = this.byId("kontrakTextStatusChange");
            var oValidDateLabel = this.byId("validDateLabel");
            var oValidDateStart = this.byId("validDateStartStatusChange");
            var oValidDateDesc = this.byId("validDateDesc");

            // --- Homebase Tujuan fields ---
            if (sReasonKey === "03") {
                if (oHomebaseTujuanLabel) oHomebaseTujuanLabel.setVisible(true);
                if (oHomebaseTujuan) oHomebaseTujuan.setVisible(true);
                if (oHomebaseTujuanText) oHomebaseTujuanText.setVisible(true);
                if (oHomebaseAsal) oHomebaseAsal.setVisible(true);
                if (oHomebaseAsalText) oHomebaseAsalText.setVisible(true);

                // Hide kontrak and valid date fields
                if (oKontrakStatusChange) oKontrakStatusChange.setVisible(false);
                if (oKontrakText) oKontrakText.setVisible(false);
                if (oValidDateLabel) oValidDateLabel.setVisible(false);
                if (oValidDateStart) oValidDateStart.setVisible(false);
                if (oValidDateDesc) oValidDateDesc.setVisible(false);
            } else {
                // Hide homebase fields
                if (oHomebaseTujuanLabel) oHomebaseTujuanLabel.setVisible(false);
                if (oHomebaseTujuan) oHomebaseTujuan.setVisible(false);
                if (oHomebaseTujuanText) oHomebaseTujuanText.setVisible(false);
                if (oHomebaseAsal) oHomebaseAsal.setVisible(false);
                if (oHomebaseAsalText) oHomebaseAsalText.setVisible(false);

                // Show kontrak and valid date fields
                if (oKontrakStatusChange) oKontrakStatusChange.setVisible(true);
                if (oKontrakText) oKontrakText.setVisible(true);
                if (oValidDateLabel) oValidDateLabel.setVisible(true);
                if (oValidDateStart) oValidDateStart.setVisible(true);
                if (oValidDateDesc) oValidDateDesc.setVisible(true);
            }
        },

        // onSubmitApproval: function () {
        //     const sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
        //     const sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
        //     const sRequestId = this._oDetailApprovalStatModel.getProperty("/RequestId");

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

        //                     if (
        //                         oMatchedApproval.ApproverName &&
        //                         oMatchedApproval.ApproverName.FormattedName !== oCurrentUser.EmployeeName.FormattedName
        //                     ) {
        //                         console.warn("ApproverName mismatch. Using fallback to correct it.");
        //                         oMatchedApproval.ApproverName = oCurrentUser.EmployeeName;
        //                     }

        //                     console.log("Matched approval entry:", oMatchedApproval);

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

        //                     // Get reason for action (Massg) from detail model
        //                     const sReason = this._oDetailApprovalStatModel.getProperty("/Massg");

        //                     // Only allow A1 with reason 01 or 02
        //                     if (
        //                         oMatchedApproval.Stat === "A1" && (sReason === "01" || sReason === "02")
        //                     ) {
        //                         const sRekomHcm = this.byId("rekomendasiHCMApprovalStat").getValue();
        //                         const sDispoNote = this.byId("dispoNoteApprovalStat").getValue();
        //                         const sSalaryFnl = this.byId("gajiApprovalStat").getValue() ? this.byId("gajiApprovalStat").getValue().replace(/\D/g, '') : "0";
        //                         const oDisposisiRadioGroup = this.byId("disposisiApprovalStat1");
        //                         const iDisposisiIndex = oDisposisiRadioGroup ? oDisposisiRadioGroup.getSelectedIndex() : -1;

        //                         oApprovalData.ZrekomHcm = sRekomHcm;
        //                         oApprovalData.Zdisposisi = (iDisposisiIndex + 1).toString();
        //                         oApprovalData.Znotedisp = sDispoNote;
        //                         oApprovalData.Zsalaryfnl = sSalaryFnl;

        //                         // Validate mandatory document submission for A1 (DM Staff) with reason 01/02
        //                         const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //                         const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        //                         // if (!aFiles || aFiles.length === 0) {
        //                         //     MessageBox.error("Please upload at least one document before submitting.");
        //                         //     return;
        //                         // }
        //                     } else {
        //                         // Remove access for VT, VC, A5, and all other roles
        //                         MessageBox.error("You are not authorized to submit approval for this role.");
        //                         return;
        //                     }

        //                     console.log("Payload for submission:", oApprovalData);

        //                     // Submit the approval data
        //                     this._oSelectedModel.update(`/RequestSet(guid'${sRequestId}')`, oApprovalData, {
        //                         method: "MERGE",
        //                         success: () => {
        //                             this._disableApprovalButtons();
                                    
        //                             MessageBox.success("Data berhasil disetujui.", {
        //                                 onClose: () => {
        //                                     this._oApprovalDialog.close();
        //                                     var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        //                                     oRouter.navTo("approval", {}, true);
        //                                 }
        //                             });
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

        // _validateA1Submission: function() {
        //     var sReason = this._oDetailApprovalStatModel.getProperty("/Massg");
        //     var aMessages = [];
        //     var sRekomHcm = this.byId("rekomendasiHCMApprovalStat").getValue();
        //     var oDisposisiRadioGroup = this.byId("disposisiApprovalStat1");
        //     var iDisposisiIndex = oDisposisiRadioGroup ? oDisposisiRadioGroup.getSelectedIndex() : -1;
        //     var sDispoNote = this.byId("dispoNoteApprovalStat").getValue();
        //     var sSalaryFnl = this.byId("gajiApprovalStat").getValue() ? this.byId("gajiApprovalStat").getValue().replace(/\D/g, '') : "0";
        //     var oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     var aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];

        //     // For reason 03, only rekomendasi is required
        //     if (sReason === "03") {
        //         if (!sRekomHcm) aMessages.push("Silakan isi rekomendasi HCM sebelum diajukan.");
        //         // if (!aFiles || aFiles.length === 0) aMessages.push("Silakan unggah minimal 1 dokumen sebelum diajukan.");
        //     } else {
        //         // For reason 01 and 02, all fields are required
        //         if (!sRekomHcm) aMessages.push("Silakan isi rekomendasi HCM sebelum diajukan.");
        //         if (iDisposisiIndex === -1) aMessages.push("Silakan pilih disposisi sebelum diajukan.");
        //         if (!sDispoNote) aMessages.push("Silakan isi catatan disposisi sebelum diajukan.");
        //         if (!sSalaryFnl || sSalaryFnl === "0") aMessages.push("Silakan isi gaji final sebelum diajukan.");
        //         if (!aFiles || aFiles.length === 0) aMessages.push("Silakan unggah minimal 1 dokumen sebelum diajukan.");
        //     }

        //     if (aMessages.length > 0) {
        //         sap.m.MessageBox.warning(aMessages.join("\n"));
        //         return false;
        //     }
        //     return true;
        // },

        _validateA1Submission: function() {
            var sRekomHcm = this.byId("rekomendasiHCMApprovalStat").getValue();

            // If any required field is missing, show a single warning
            if (
                !sRekomHcm
            ) {
                sap.m.MessageBox.warning("Mohon untuk lengkapi data yang diperlukan.");
                return false;
            }
            return true;
        },

        _validateA3Submission: function() {
            var oActiveApprovalEntry = this.getView().getModel("detailApprovalStatModel").getProperty("/activeApprovalEntry");
            var sStat = oActiveApprovalEntry && oActiveApprovalEntry.Stat;    
            var sRekomHcm = this.byId("rekomendasiHCMApprovalStat").getValue();
            var oDisposisiRadioGroup = this.byId("disposisiApprovalStat1");
            var iDisposisiIndex = oDisposisiRadioGroup ? oDisposisiRadioGroup.getSelectedIndex() : -1;
            var sDispoNote = this.byId("dispoNoteApprovalStat").getValue();
            var sSalaryFnl = this.byId("gajiApprovalStat").getValue() ? this.byId("gajiApprovalStat").getValue().replace(/\D/g, '') : "0";
            var oFileAttachmentModel = this.getView().getModel("fileAttachment");
            var aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];

             // Special: If STAT is V1, only require upload document
            if (sStat === "V1") {
                if (!aFiles || aFiles.length === 0) {
                    sap.m.MessageBox.warning("Mohon unggah dokumen yang diperlukan.");
                    return false;
                }
                return true;
            }

            // If any required field is missing, show a single warning
            if (
                !sRekomHcm ||
                iDisposisiIndex === -1 ||
                !sDispoNote ||
                !sSalaryFnl || sSalaryFnl === "0" ||
                !aFiles || aFiles.length === 0
            ) {
                sap.m.MessageBox.warning("Mohon untuk lengkapi data yang diperlukan.");
                return false;
            }
            return true;
        },

        // _validateA1Submission: function() {
        //     // var oReviseState = this.getView().getModel("reviseState");
        //     // var isReviseVT = oReviseState.getProperty("/isReviseVT");
        //     // var isReviseVC = oReviseState.getProperty("/isReviseVC");
        //     // if (isReviseVT || isReviseVC) {
        //     //     // No validation needed if revising
        //     //     return true;
        //     // }
        //     // Validate all required fields
        //     var sRekomHcm = this.byId("rekomendasiHCMApprovalStat").getValue();
        //     var oDisposisiRadioGroup = this.byId("disposisiApprovalStat1");
        //     var iDisposisiIndex = oDisposisiRadioGroup ? oDisposisiRadioGroup.getSelectedIndex() : -1;
        //     var sDispoNote = this.byId("dispoNoteApprovalStat").getValue();
        //     var sSalaryFnl = this.byId("gajiApprovalStat").getValue() ? this.byId("gajiApprovalStat").getValue().replace(/\D/g, '') : "0";
        //     var oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     var aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        //     var aMessages = [];
        //     if (!sRekomHcm) aMessages.push("Silakan isi rekomendasi HCM sebelum diajukan.");
        //     if (iDisposisiIndex === -1) aMessages.push("Silakan pilih disposisi sebelum diajukan.");
        //     if (!sDispoNote) aMessages.push("Silakan isi catatan disposisi sebelum diajukan.");
        //     if (!sSalaryFnl || sSalaryFnl === "0") aMessages.push("Silakan isi gaji final sebelum diajukan.");
        //     if (!aFiles || aFiles.length === 0) aMessages.push("Silakan unggah minimal 1 dokumen sebelum diajukan.");
        //     if (aMessages.length > 0) {
        //         sap.m.MessageBox.warning(aMessages.join("\n"));
        //         return false;
        //     }
        //     return true;
        // },

        _disableApprovalButtons: function () {
            const oButtonStateModel = this.getView().getModel("buttonState");
            oButtonStateModel.setProperty("/isApproveEnabled", false);
            oButtonStateModel.setProperty("/isRejectEnabled", false);
            oButtonStateModel.setProperty("/isReviseEnabled", false);
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

        onRevisePress: function () {
            this._openApprovalDialog("revise");
            // this._disableApprovalButtons();
        },

        // onSubmitApproval: function () {
        //     const sAction = this._oApprovalDialog.data("action"); // "approve" or "reject"
        //     const sNotes = sap.ui.getCore().byId("approvalNotes").getValue();
        //     const sRequestId = this._oDetailApprovalStatModel.getProperty("/RequestId");
        
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

        //     // Validate Disposisi input
        //     const oDisposisiModel = this.getView().getModel("disposisiApprovalStat1");
        //     const iSelectedIndex = oDisposisiModel.getProperty("/selectedIndex");

        //     if (iSelectedIndex === -1) {
        //         MessageBox.error("Please select a value in the Disposisi panel before submitting.");
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
        //                         Abbreviation: oMatchedApproval.Abbreviation,
        //                         Status: sAction === "approve" ? "A" : "R",
        //                         StatusText: sAction === "approve" ? "Approved" : "Rejected",
        //                         ApprovalUser: sLoggedInUserId,
        //                         Notes: sNotes,
        //                         ApprovalDate: oDateTime.ApprovalDate,
        //                         ApprovalTime: oDateTime.ApprovalTime
        //                     };
        
        //                     // Add additional data based on STAT and validate inputs
        //                     if (oMatchedApproval.Stat === "VT") {
        //                         const bVerifySelected = this.byId("verifyResultApproval").getSelected();
        //                         const sHasilAssesment = this.byId("assessmentResultApproval").getValue();
        //                         if (!bVerifySelected) {
        //                             MessageBox.error("Please select a verification result before submitting.");
        //                             return;
        //                         }
        //                         if (!sHasilAssesment) {
        //                             MessageBox.error("HasilAssesment data is empty. Please fill it before submitting.");
        //                             return;
        //                         }
        //                         oApprovalData.Zverify = bVerifySelected ? "1" : "";
        //                     } else if (oMatchedApproval.Stat === "VC") {
        //                         const oRadioGroup = this.byId("hasilApprovalRadioGroup");
        //                         const iRadioIndex = oRadioGroup ? oRadioGroup.getSelectedIndex() : -1;
        //                         if (iRadioIndex === -1) {
        //                             MessageBox.error("Please select one BI Checking option before submitting.");
        //                             return;
        //                         }
        //                         oApprovalData.Zbichecking = aSelectedCheckboxes.join(",");
        //                         oApprovalData.Znotebicheck = this.byId("hasilBiCheckingApproval").getValue();
        
        //                         // Validate mandatory document submission for VC
        //                         const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //                         const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        //                         if (!aFiles || aFiles.length === 0) {
        //                             MessageBox.error("Please upload at least one document before submitting.");
        //                             return;
        //                         }
        //                     } else if (oMatchedApproval.Stat === "A5") {
        //                         const sRekomHcm = this.byId("rekomendasiHCMApproval").getValue();
        //                         // const sDisposisi = this.getView().getModel("disposisiApproval1").getProperty("/selectedIndex");
        //                         const sDispoNote = this.byId("dispoNoteApproval").getValue();
        //                         const sSalaryFnl = this.byId("gajiApproval").getValue() ? this.byId("gajiApproval").getValue().replace(/\D/g, '') : "0";

        //                         const oDisposisiRadioGroup = this.byId("disposisiApprovalM1");
        //                         const iDisposisiIndex = oDisposisiRadioGroup ? oDisposisiRadioGroup.getSelectedIndex() : -1;
        
        //                         if (!sRekomHcm || !sDispoNote || !sSalaryFnl || iDisposisiIndex === -1) {
        //                             MessageBox.error("Please fill in all required fields in the Disposisi panel before submitting.");
        //                             return;
        //                         }
        
        //                         oApprovalData.ZrekomHcm = sRekomHcm;
        //                         oApprovalData.Zdisposisi = (iDisposisiIndex + 1).toString();
        //                         oApprovalData.Znotedisp = sDispoNote;
        //                         oApprovalData.Zsalaryfnl = sSalaryFnl;
        
        //                         // Validate mandatory document submission for A5
        //                         const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //                         const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        //                         if (!aFiles || aFiles.length === 0) {
        //                             MessageBox.error("Please upload at least one document before submitting.");
        //                             return;
        //                         }
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
            const oModel = this.getOwnerComponent().getModel("StatusChange");
            const oFileAttachmentModel = this.getView().getModel("fileAttachment");
            const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
            if (!aFiles || aFiles.length === 0) {
                return;
            }

            // Always get the latest approval entry for the current user
            const oCurrentUserModel = this.getView().getModel("currentUser");
            const sCurrentUserId = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");
            let sUserStat = null;

            // Read approval entries to get the correct STAT for the current user
            oModel.read(`/RequestSet(guid'${sRequestId}')/toApproval`, {
                success: function (oData) {
                    const aApprovals = oData.results || [];
                    // --- Fix: Find the latest V1 entry for the current user ---
                    let oV1Approval = aApprovals
                        .filter(entry => entry.ApproverId === sCurrentUserId && entry.Stat === "V1")
                        .sort((a, b) => parseInt(b.SequenceNumber, 10) - parseInt(a.SequenceNumber, 10))[0];

                    if (oV1Approval) {
                        sUserStat = oV1Approval.Stat;
                    } else {
                        // fallback to latest approval entry for current user
                        const oLatestApproval = aApprovals
                            .filter(entry => entry.ApproverId === sCurrentUserId)
                            .sort((a, b) => parseInt(b.SequenceNumber, 10) - parseInt(a.SequenceNumber, 10))[0];
                        sUserStat = oLatestApproval ? oLatestApproval.Stat : (oCurrentUserModel && oCurrentUserModel.getProperty("/Stat"));
                    }

                    // --- rest of your upload logic ---
                    const sPicName = oCurrentUserModel.getProperty("/EmployeeName/FormattedName");
                    const sPicId = oCurrentUserModel.getProperty("/EmployeeNumber");

                    let sTypeDoc = "";
                    let sPicPosition = "Data Management";
                    switch (sUserStat) {
                        case "A1":
                        case "A3":
                            sTypeDoc = "Hasil Disposisi";
                            break;
                        case "V1":
                            sTypeDoc = "SK Perpanjangan Kontrak";
                            break;
                        case "V0":
                            sTypeDoc = "SK Perpanjangan Kontrak";
                            sPicPosition = "Requestor";
                            break;
                        default:
                            MessageBox.error("Invalid STAT for the current user. Cannot proceed with file upload.");
                            return;
                    }

                    this._oBusy.open();
                    const sPath = `/FileAttachmentSet`;
                    const aFilters = [new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)];

                    oModel.read(sPath, {
                        filters: aFilters,
                        success: function (oData) {
                            const aExistingFiles = oData.results || [];
                            let iNextSeqnr = aExistingFiles.length;

                            const processNextFile = (index) => {
                                if (index >= aFiles.length) {
                                    this._oBusy.close();
                                    MessageBox.success("Dokumen berhasil diunggah.", {
                                        onClose: () => {
                                            console.log("File upload process completed.");
                                        }
                                    });
                                    return;
                                }
                                const oFile = aFiles[index];
                                const oPayload = {
                                    Reqid: sRequestId,
                                    Seqnr: (iNextSeqnr++).toString(),
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
                                        "ZHR_STAT_CHANGE_MAN_SRV_01",
                                        "Mdt"
                                    ])
                                };
                                oModel.create("/FileAttachmentSet", oPayload, {
                                    success: function () {
                                        processNextFile(index + 1);
                                    }.bind(this),
                                    error: function (oError) {
                                        this._oBusy.close();
                                        MessageBox.error("Failed to upload file '" + oFile.FileName + "'.");
                                    }.bind(this)
                                });
                            };
                            processNextFile(0);
                        }.bind(this),
                        error: function (oError) {
                            this._oBusy.close();
                            MessageBox.error("Failed to fetch existing documents. Cannot proceed with file upload.");
                        }.bind(this)
                    });
                }.bind(this),
                error: function (oError) {
                    MessageBox.error("Failed to fetch approval entries for file upload.");
                }
            });
        },

        // onSubmitFiles: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot upload files.");
        //         return;
        //     }
        //     const oModel = this.getOwnerComponent().getModel("StatusChange");
        //     const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        //     if (!aFiles || aFiles.length === 0) {
        //         return;
        //     }

        //     const oActiveApprovalEntry = this.getView().getModel("detailApprovalStatModel").getProperty("/activeApprovalEntry");
        //     let sUserStat = oActiveApprovalEntry && oActiveApprovalEntry.Stat;
        //     if (!sUserStat) {
        //         // fallback to currentUser if no active approval entry
        //         const oCurrentUserModel = this.getView().getModel("currentUser");
        //         sUserStat = oCurrentUserModel && oCurrentUserModel.getProperty("/Stat");
        //     }

        //     // Use Stat from active approval entry
        //     // const oActiveApprovalEntry = this.getView().getModel("detailApprovalStatModel").getProperty("/activeApprovalEntry");
        //     // const sUserStat = oActiveApprovalEntry && oActiveApprovalEntry.Stat;
        //     console.log("onSubmitFiles: oActiveApprovalEntry =", oActiveApprovalEntry, "sUserStat =", sUserStat);
        //     const oCurrentUserModel = this.getView().getModel("currentUser");
        //     const sPicName = oCurrentUserModel.getProperty("/EmployeeName/FormattedName");
        //     const sPicId = oCurrentUserModel.getProperty("/EmployeeNumber");

        //     let sTypeDoc = "";
        //     let sPicPosition = "Data Management";
        //     switch (sUserStat) {
        //         case "A1":
        //         case "A3":
        //             sTypeDoc = "Hasil Disposisi";
        //             break;
        //         case "V1":
        //             sTypeDoc = "SK Perpanjangan Kontrak";
        //             break;
        //         case "V0":
        //             sTypeDoc = "SK Perpanjangan Kontrak";
        //             sPicPosition = "Requestor";
        //             break;
        //         default:
        //             MessageBox.error("Invalid STAT for the current user. Cannot proceed with file upload.");
        //             return;
        //     }

        //     this._oBusy.open();
        //     const sPath = `/FileAttachmentSet`;
        //     const aFilters = [new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)];

        //     oModel.read(sPath, {
        //         filters: aFilters,
        //         success: function (oData) {
        //             const aExistingFiles = oData.results || [];
        //             let iNextSeqnr = aExistingFiles.length;

        //             const processNextFile = (index) => {
        //                 if (index >= aFiles.length) {
        //                     this._oBusy.close();
        //                     MessageBox.success("Dokumen berhasil diunggah.", {
        //                         onClose: () => {
        //                             console.log("File upload process completed.");
        //                         }
        //                     });
        //                     return;
        //                 }
        //                 const oFile = aFiles[index];
        //                 const oPayload = {
        //                     Reqid: sRequestId,
        //                     Seqnr: (iNextSeqnr++).toString(),
        //                     FileName: oFile.FileName,
        //                     FileType: oFile.FileType,
        //                     FileSize: oFile.FileSize.toString(),
        //                     Attachment: oFile.Attachment,
        //                     CreatedOn: new Date().toISOString().split(".")[0],
        //                     TypeDoc: sTypeDoc,
        //                     PicPosition: sPicPosition,
        //                     PicName: sPicName,
        //                     PicId: sPicId,
        //                     Url: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("urlpath", [
        //                         sRequestId,
        //                         iNextSeqnr - 1,
        //                         "ZHR_STAT_CHANGE_MAN_SRV_01",
        //                         "Mdt"
        //                     ])
        //                 };
        //                 oModel.create("/FileAttachmentSet", oPayload, {
        //                     success: function () {
        //                         processNextFile(index + 1);
        //                     }.bind(this),
        //                     error: function (oError) {
        //                         this._oBusy.close();
        //                         MessageBox.error("Failed to upload file '" + oFile.FileName + "'.");
        //                     }.bind(this)
        //                 });
        //             };
        //             processNextFile(0);
        //         }.bind(this),
        //         error: function (oError) {
        //             this._oBusy.close();
        //             MessageBox.error("Failed to fetch existing documents. Cannot proceed with file upload.");
        //         }.bind(this)
        //     });
        // },

        // onSubmitFiles: function (sRequestId) {
        //     if (!sRequestId) {
        //         MessageBox.error("No request ID found. Cannot upload files.");
        //         return;
        //     }

        //     // Always use the default model
        //     const oModel = this.getOwnerComponent().getModel("StatusChange");

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
        //     console.log("onSubmitFiles: sUserStat =", sUserStat);

        //     // Determine TypeDoc and PicPosition based on STAT
        //     let sTypeDoc = "";
        //     let sPicPosition = "";

        //     switch (sUserStat) {
        //         case "A1":
        //             sTypeDoc = "Hasil Disposisi";
        //             sPicPosition = "Data Management";
        //             break;
        //         case "A3":
        //             sTypeDoc = "Hasil Disposisi";
        //             sPicPosition = "Data Management";
        //             break;
        //         case "V1":
        //             sTypeDoc = "SK Perpanjangan Kontrak";
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
        //                     MessageBox.success("Dokumen berhasil diunggah.", {
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
        //                     Url: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("urlpath", [
        //                         sRequestId,
        //                         iNextSeqnr - 1,
        //                         "ZHR_STAT_CHANGE_MAN_SRV_01",
        //                         "Mdt"
        //                     ])
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

        _addNextApprovalEntry: function(sRequestId, nextApproverId, nextStat, nextObjectType, nextAbbreviation) {
            const oModel = this.getOwnerComponent().getModel("StatusChange");
            oModel.read(`/RequestSet(guid'${sRequestId}')/toApproval`, {
                success: function(oData) {
                    const aApprovals = oData.results || [];
                    let iNextSeqnr = 1;
                    if (aApprovals.length > 0) {
                        const maxSeqnr = Math.max.apply(null, aApprovals.map(a => parseInt(a.SequenceNumber, 10)));
                        iNextSeqnr = maxSeqnr + 1;
                    }
                    const oPayload = {
                        RequestId: sRequestId,
                        SequenceNumber: iNextSeqnr.toString().padStart(3, "0"),
                        Stat: nextStat,
                        ObjectType: nextObjectType || "",
                        ApproverId: nextApproverId,
                        Abbreviation: nextAbbreviation || "",
                        Status: "",
                        StatusText: "",
                        ApprovalUser: "",
                        Notes: "",
                        ApprovalDate: null,
                        ApprovalTime: null
                    };
                    oModel.create("/ApprovalSet", oPayload, {
                        success: function() {
                            MessageBox.success("Approval entry created successfully.");
                        },
                        error: function(oError) {
                            MessageBox.error("Failed to create approval entry.");
                        }
                    });
                },
                error: function(oError) {
                    MessageBox.error("Failed to fetch approval list for next Seqnr.");
                }
            });
        },

        // _setVerificationAccess: function () {
        //     const oCurrentUserModel = this.getView().getModel("currentUser");
        //     if (!oCurrentUserModel) {
        //         console.error("currentUser model not available");
        //         return;
        //     }
        
        //     const sLoggedInEmployeeNumber = oCurrentUserModel.getProperty("/EmployeeNumber");
        //     const sUserStat = oCurrentUserModel.getProperty("/Stat");
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
        //             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //             oVerificationModel.setProperty("/isUploadVisible", false); 
        //             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //             console.log("Access set for Approver roles");
        //             break;
        
        //         case "VT":
        //             oVerificationModel.setProperty("/isAssessmentEnabled", true);
        //             oVerificationModel.setProperty("/isBiCheckingEnabled", false);
        //             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //             oVerificationModel.setProperty("/isSubmitVisible", true);
        //             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //             oVerificationModel.setProperty("/isUploadVisible", false); 
        //             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //             console.log("Access set for Verificator 1 (Talent Management)");
        //             break;
        
        //         case "VC":
        //             oVerificationModel.setProperty("/isAssessmentEnabled", false);
        //             oVerificationModel.setProperty("/isBiCheckingEnabled", true);
        //             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //             oVerificationModel.setProperty("/isSubmitVisible", true);
        //             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //             oVerificationModel.setProperty("/isUploadVisible", true); 
        //             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //             console.log("Access set for Verificator 2 (BI Checking)");
        //             break;
        
        //         case "A5":
        //             oVerificationModel.setProperty("/isAssessmentEnabled", false);
        //             oVerificationModel.setProperty("/isBiCheckingEnabled", false);
        //             oVerificationModel.setProperty("/isDisposisiEnabled", true);
        //             oVerificationModel.setProperty("/isSubmitVisible", true);
        //             oVerificationModel.setProperty("/isDownloadEnabled", true);
        //             oVerificationModel.setProperty("/isUploadVisible", true); 
        //             oVerificationModel.setProperty("/isSalaryFinalEditable", true);
        //             console.log("Access set for Approver A5 (Disposisi)");
        //             break;
        
        //         default:
        //             oVerificationModel.setProperty("/isAssessmentEnabled", false);
        //             oVerificationModel.setProperty("/isBiCheckingEnabled", false);
        //             oVerificationModel.setProperty("/isDisposisiEnabled", false);
        //             oVerificationModel.setProperty("/isSubmitVisible", false);
        //             oVerificationModel.setProperty("/isDownloadEnabled", false);
        //             oVerificationModel.setProperty("/isUploadVisible", false); 
        //             oVerificationModel.setProperty("/isSalaryFinalEditable", false);
        //             console.log("Access set for unknown role");
        //             break;
        //     }

        //     console.log("isUploadVisible for VT:", oVerificationModel.getProperty("/isUploadVisible"));
        // },

        onDownloadDisposisi: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("detailApprovalStatModel");
        
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
            const sUrl = `/sap/opu/odata/sap/ZHR_STAT_CHANGE_MAN_SRV_01/TemplateCollection(EmployeeNumber='${sEmpNo}')/$value`;
        
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

        onDisposisiSelect: function(oEvent) {
            var iSelectedIndex = oEvent.getParameter("selectedIndex");
            // Store as 1-based (1 or 2)
            // this.getView().getModel("disposisiApproval1").setProperty("/selectedIndex", iSelectedIndex);
            // If you want to store as string "1" or "2" in detailApprovalModel:
            this.getView().getModel("detailApprovalStatModel").setProperty("/Zdisposisi", (iSelectedIndex + 1).toString());
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
            const sRequestId = this._oDetailApprovalStatModel.getProperty("/RequestId");
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