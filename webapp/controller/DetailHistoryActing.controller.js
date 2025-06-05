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

    return BaseController.extend("bsim.hcmapp.man.movement.controller.DetailHistoryActing", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._oDetailHistoryActingModel = new JSONModel();
            this.getView().setModel(this._oDetailHistoryActingModel, "HistoryActing");
            this.getRouter().getRoute("detailhistoryacting").attachPatternMatched(this._onDetailHistoryActingRouteMatched, this);

            let oEmployeeModel = new JSONModel({

            });
            this.getView().setModel(oEmployeeModel, "employee");

            const oDropdownModel = new sap.ui.model.json.JSONModel({
                selectedSalaryAdj: "2",
                selectedAs: "1",
                isEmployeeChangeEnabled: false,
                isSalaryAdjEnabled: false,
                
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

            // Set the Grievances OData model
            const oGrievancesModel = this.getOwnerComponent().getModel("Grievances");
            if (!oGrievancesModel) {
                console.error("Grievances model is not available.");
                return;
            }

            oGrievancesModel.read("/RequestSet", {
                urlParameters: {
                    "$expand": "toAttachmentView", // Expand toAttachmentView
                    "$orderby": "CreatedOn desc, CreatedAt desc" // Sort by CreatedOn and CreatedAt descending
                },
                success: (oData) => {
                    console.log("Grievances data with attachments loaded successfully:", oData);
            
                    const aRequests = oData.results || [];
                    const sEmployeeNumber = this.getView().getModel("employee").getProperty("/EmployeeNumber");
            
                    if (!sEmployeeNumber) {
                        console.error("Employee number is missing in the 'employee' model.");
                        // sap.m.MessageBox.error("Employee number is missing. Cannot fetch document.");
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

            var oDate = new Date();
            oDate.setDate(1);

            var sFormattedEndDate = "9999-12-31";
            var sFormattedDate = oDate.toISOString().split("T")[0];

            this.getView().byId("effectiveDateEndActing").setValue(sFormattedEndDate);
            this.getView().byId("effectiveDateStartActing").setValue(sFormattedDate);
        },

        // _onDetailHistoryActingRouteMatched: function (oEvent) {
        //     var sRequestId = oEvent.getParameter("arguments").RequestId;
        //     if (this._isValidGuid(sRequestId)) {
        //         this._getDetailHistoryActingData(sRequestId);
        //         this.loadSubmittedDocuments(sRequestId);
        //         this.loadApprovalHistoryWithRequestor(sRequestId);
        //     } else {
        //         console.error("Invalid Request ID format");
        //         MessageBox.error("Invalid Request ID format");
        //     }
        // },

        _onDetailHistoryActingRouteMatched: function (oEvent) {
            var sRequestId = oEvent.getParameter("arguments").RequestId;
            if (this._isValidGuid(sRequestId)) {
                this._currentUser(sRequestId).then(() => {
                    this._getDetailHistoryActingData(sRequestId);
                });
                this.loadSubmittedDocuments(sRequestId);
                this.loadApprovalHistoryWithRequestor(sRequestId);
            } else {
                console.error("Invalid Request ID format");
                MessageBox.error("Invalid Request ID format");
            }
            // const oArguments = oEvent.getParameter("arguments") || {};
            const EmployeeNumber = oArguments.EmployeeNumber;
            const oAppModel = this.getModel("appModel");
        
            if (!EmployeeNumber) {
                MessageBox.error("Employee number is missing. Cannot proceed.");
                this.onNavBack();
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel("Acting");

            oModel.read("/RequestSet", {
                filters: [
                    new sap.ui.model.Filter("EmployeeNumber", sap.ui.model.FilterOperator.EQ, EmployeeNumber),
                    new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.NE, "A7")
                ],
                success: (oData) => {
                    const aRequests = oData.results || [];
                    const hasPendingRequest = aRequests.some(
                        r => r.EmployeeNumber === EmployeeNumber && r.Status !== "A7"
                    );
        
                    if (hasPendingRequest) {
                        MessageBox.error(
                            "A acting request for this employee is already in progress. Please complete it before creating a new one.",
                            { onClose: () => this.onNavBack() }
                        );
                        return;
                    }
        
                    // Tidak ada request yang menggantung, lanjutkan
                    this._getEmployeeData(EmployeeNumber)
                        .then(() => {
                            console.log("Loaded employee data for:", EmployeeNumber);

                            this._sRequestId = oArguments?.requestId || oAppModel?.getProperty("/selectedRequest/RequestId");
        
                            if (this._sRequestId) {
                                this._getRequestData();
                            } else {
                                this.getRouter().navTo("acting", {
                                    EmployeeNumber: EmployeeNumber
                                });
                                
                            }
                        })
                        .catch((err) => {
                            console.error("Error loading employee data:", err);
                            MessageBox.error("Failed to load employee data.");
                            this.onNavBack();
                        });
                },
                error: (err) => {
                    console.error("Error checking existing requests:", err);
                    MessageBox.error("Failed to check existing requests.", {
                        onClose: () => this.onNavBack()
                    });
                }
            });
        },

        _isValidGuid: function (sGuid) {
            var guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            return guidRegex.test(sGuid);
        },

        _currentUser: function (sRequestId) {
            console.log("Current User Function - Request ID:", sRequestId);

            return new Promise((resolve, reject) => {
                this._oBusy.open();

                const oDataModel = this.getOwnerComponent().getModel("Acting");

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

        _getDetailHistoryActingData: function (sRequestId) {
            var that = this;
            var oModel = this.getView().getModel("Acting");
            this._oBusy.open();

            oModel.read(`/RequestSet(guid'${sRequestId}')`, {
                success: function (oRequestData) {
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

                            console.log("Status:", oCombinedData.Status);
                            console.log("StatusText:", oCombinedData.StatusText);
                            // console.log("PicNumber:", oCombinedData.PicNumber);
                            console.log("PicNumber:", oCombinedData.PicNumber, "CurrentUser:", sCurrentUserEmpNo)


                            // --- Begin: Set isEditable flag ---
                            var isEditable = false;
                            // Get current user EmployeeNumber (adjust model name if needed)
                            var oCurrentUserModel = that.getView().getModel("currentUser");
                            // var oCurrentUserModel = that.getOwnerComponent().getModel("currentUser");
                            var sCurrentUserEmpNo = oCurrentUserModel && oCurrentUserModel.getProperty("/EmployeeNumber");

                            if (
                                oCombinedData.Status === "V" &&
                                // oCombinedData.StatusText === "Revise" &&
                                oCombinedData.PicNumber === sCurrentUserEmpNo
                            ) {
                                isEditable = true;
                            }
                            oCombinedData.isEditable = isEditable;
                            // --- End: Set isEditable flag ---

                            that._oDetailHistoryActingModel.setData(oCombinedData);
                            that._oBusy.close();
                        },
                        error: function (oError) {
                            MessageBox.error("Failed to load employee data");
                            that._oBusy.close();
                        }
                    });
                },
                error: function (oError) {
                    MessageBox.error("Failed to load request data");
                    that._oBusy.close();
                }
            });
        },

        // _getDetailHistoryActingData: function (sRequestId) {
        //     var that = this;
        //     var oModel = this.getView().getModel("Acting");
        //     this._oBusy.open();

        //     oModel.read(`/RequestSet(guid'${sRequestId}')`, {
        //         success: function (oRequestData) {
        //             var sEmployeeNumber = oRequestData.EmployeeNumber;
        //             // Set employee number in the employee model
        //             var oEmployeeModel = that.getView().getModel("employee");
        //             if (oEmployeeModel) {
        //                 oEmployeeModel.setProperty("/EmployeeNumber", sEmployeeNumber);
        //             } else {
        //                 oEmployeeModel = new sap.ui.model.json.JSONModel({ EmployeeNumber: sEmployeeNumber });
        //                 that.getView().setModel(oEmployeeModel, "employee");
        //             }

        //             oModel.read(`/EmployeeDetailSet('${sEmployeeNumber}')`, {
        //                 success: function (oEmployeeData) {
        //                     var oCombinedData = Object.assign({}, oEmployeeData, oRequestData, {
        //                         EmployeeName: oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || oRequestData.EmployeeName,
        //                     });
        //                     that._oDetailHistoryActingModel.setData(oCombinedData);
        //                     that._oBusy.close();
        //                 },
        //                 error: function (oError) {
        //                     MessageBox.error("Failed to load employee data");
        //                     that._oBusy.close();
        //                 }
        //             });
        //         },
        //         error: function (oError) {
        //             MessageBox.error("Failed to load request data");
        //             that._oBusy.close();
        //         }
        //     });
        // },

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

        loadSubmittedDocuments: function (sRequestId) {
            if (!sRequestId) {
                MessageBox.error("No request ID found. Cannot fetch documents.");
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel("Acting");
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
            const oCurrentUserModel = this.getView().getModel("currentUser");

            if (!oEmployeeModel || !oCurrentUserModel) {
                sap.m.MessageBox.error("Required models are not available.");
                return;
            }

            const oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
            const sLoggedInEmployeeId = oCurrentUserModel.getProperty("/EmployeeNumber");
            const oPlansReqDesc = oCurrentUserModel.getProperty("/EmployeePositionLongtext");
            const oNamaKantorReq = oCurrentUserModel.getProperty("/NamaKantorReq");
            const oDivisiDescReq = oCurrentUserModel.getProperty("/DivisionText");

            const oDropdownModel = this.getView().getModel("dropdown");
            const sSelectedAs = oDropdownModel.getProperty("/selectedAs") || "";

            // Get models
            const oPositionModel = this.getView().getModel("position");
            const oGroupModel = this.getView().getModel("group");
            const oSubGroupModel = this.getView().getModel("subGroup");
            const oAreaModel = this.getView().getModel("area");
            const oSubAreaModel = this.getView().getModel("subArea");

            // Get selected objects
            const oSelectedPosition = oPositionModel.getProperty("/selectedPosition") || {};
            const oSelectedGroup = oGroupModel.getProperty("/selectedGroup") || {};
            const oSelectedSubGroup = oSubGroupModel.getProperty("/selectedSubGroup") || {};
            const oSelectedArea = oAreaModel.getProperty("/selectedArea") || {};
            const oSelectedSubArea = oSubAreaModel.getProperty("/selectedSubArea") || {};

            // Use value help selection if present, else fallback to position
            const PlansDest      = oSelectedPosition.Key || this.byId("PositionIdActing").getValue();
            const PlansDesc_Dest = oSelectedPosition.Value || this.byId("PositionTextActing").getText();

            const PersgDest      = oSelectedGroup.Key || oSelectedPosition.Key6 || this.byId("EmployeeGroupIdActing").getValue();
            const PersgDestDesc  = oSelectedGroup.Value || oSelectedPosition.KeyDesc6 || this.byId("EmployeeGroupTextActing").getText();

            const PerskDest      = oSelectedSubGroup.Key2 || oSelectedPosition.Key7 || this.byId("EmployeeSubgroupIdActing").getValue();
            const PerskDestDesc  = oSelectedSubGroup.Value || oSelectedPosition.KeyDesc7 || this.byId("EmployeeSubgroupTextActing").getText();

            const WerksDest      = oSelectedArea.Key || oSelectedPosition.Key4 || this.byId("PerAreaIdActing").getValue();
            const WerksDestDesc  = oSelectedArea.Value || oSelectedPosition.KeyDesc4 || this.byId("PerAreaTextActing").getText();

            const BtrtlDest      = oSelectedSubArea.Key2 || oSelectedPosition.Key5 || this.byId("PerSubAreaIdActing").getValue();
            const BtrtlDestDesc  = oSelectedSubArea.Value || oSelectedPosition.KeyDesc5 || this.byId("PerSubAreaTextActing").getText();

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

            const oData = this.getView().getModel("HistoryActing").getData();
            const sPath = "/RequestSet(guid'" + oData.RequestId + "')";

            // Show busy dialog
            if (!this._oBusyDialog) {
                this._oBusyDialog = new sap.m.BusyDialog();
            }
            this._oBusyDialog.setTitle("Please wait...");
            this._oBusyDialog.setText("Updating request...");
            this._oBusyDialog.open();

            const oModel = this.getView().getModel("Acting");
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
                        Massg: this.byId("reasonActing").getValue(),
                        MassgDesc: this.byId("newReasonTextActing").getText(),
                        BeginDate: getFormattedDate("actDateStartActing"),
                        EndDate: getFormattedDate("actDateEndActing"),
                        ZbegdaEfktf: getFormattedDate("effectiveDateStartActing"),
                        ZenddaEfktf: getFormattedDate("effectiveDateEndActing"),
                        PlansDest: PlansDest,
                        PlansDesc_Dest: PlansDesc_Dest,
                        PersgDest: PersgDest,
                        PersgDestDesc: PersgDestDesc,
                        PerskDest: PerskDest,
                        PerskDestDesc: PerskDestDesc,
                        WerksDest: WerksDest,
                        WerksDestDesc: WerksDestDesc,
                        BtrtlDest: BtrtlDest,
                        BtrtlDestDesc: BtrtlDestDesc,
                        Adjstmn: this.getView().getModel("dropdown").getProperty("/selectedSalaryAdj") || "",
                        Zsalary: this.byId("salaryAdjValueActing").getValue() ? this.byId("salaryAdjValueActing").getValue().replace(/\D/g, '') : "0",
                        Zdasar1: sSelectedAs,
                        Zexholder: this.byId("employeeChangeActing").getValue(),
                        ZexholderDesc: this.byId("employeeChangeTextActing").getText(),
                        Zdasar2: this.byId("basicConActing").getValue(),
                        PlansAsl: this.byId("currentPositionIdHistory").getValue(),
                        PlansDescAsl: this.byId("currentPositionTextHistory").getText(),
                        WerksAsl: this.byId("currentPerAreaIdActing").getValue(), 
                        WerksDescAsl: this.byId("currentPerAreaTextActing").getText(),
                        BtrtlAsl: this.byId("currentPerSubAreaIdHistory").getValue(),
                        BtrtlDescAsl: this.byId("currentPerSubAreaTextHistory").getText(),
                        OuAsl: this.byId("currentUnitOrgIdHistory").getValue(),
                        OuDecAsl: this.byId("currentUnitOrgTextHistory").getText(),
                        OuDest: this.byId("UnitOrgIdActing").getValue(),
                        OuDescDest: this.byId("UnitOrgTextActing").getText(),
                        DivisiAsl: this.byId("currentDivisionIdHistory").getValue(),
                        DivisiDescAsl: this.byId("currentDivisionTextHistory").getText(), 
                        DivisiDest: this.byId("DivisionIdActing").getValue(),
                        DivisiDescDest: this.byId("DivisionTextActing").getText(),
                        PlansReqDesc: oPlansReqDesc,
                        NamaKantorReq: oNamaKantorReq,
                        DivisiDescReq: oDivisiDescReq,
                        CareerBandDest: this.byId("careerTujuanActing").getValue(),
                        CareerBandDescDest: this.byId("careerTujuanTextActing").getText(),
                        CareerLevelDest: this.byId("careerLvlTujuanActing").getValue(),
                        CareerLevelDescDest: this.byId("careerLvlTujuanTextActing").getText(),
                        TanggalJabatanDest: getFormattedDate("tanggalBerakhirActing"),
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

        loadApprovalHistoryWithRequestor: function (sRequestId) {
            if (!sRequestId || !this._isValidGuid(sRequestId)) {
                MessageBox.error("Invalid Request ID format. Cannot fetch approval history.");
                return;
            }

            const oModel = this.getOwnerComponent().getModel("Acting"); 

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

        _loadEmployeeChangeData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Acting");
                oModel.read("/ValueHelpNumberSet", {
                    success: (oData) => {
                        const oEmployeeChangeModel = new JSONModel(oData.results);
                        this.getView().setModel(oEmployeeChangeModel, "employeechange");
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load employee data.");
                        reject(oError);
                    }
                });
            });
        },

        handleValueHelpEmployeeChange: function() {
            if (!this._oValueHelpEmployeeChangeDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpEmployee",
                    controller: this
                }).then(function(oDialog) {
                    this._oValueHelpEmployeeChangeDialog = oDialog;
                    this._oValueHelpEmployeeChangeDialog.setModel(this.getView().getModel("employeechange"), "employeechange");
                    this.getView().addDependent(this._oValueHelpEmployeeChangeDialog);
                            
                    this._loadEmployeeChangeData().then(() => {
                        this._oValueHelpEmployeeChangeDialog.open();
                    });
                    
                }.bind(this));
            } else {
                this._oValueHelpEmployeeChangeDialog.open();
            }
        },

        handleSearchEmployeeChange: function (oEvent) {
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

        handleCloseEmployeeChange: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oEmployeeChangeModel = this.getView().getModel("employeechange");
                
                oEmployeeChangeModel.setProperty("/selectedEmployeeChange", oSelectedItem);
                this.byId("employeeChangeActing").setValue(oSelectedItem.Key);
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        onEmployeeChangeInput: function (oEvent) {
            const sValue = oEvent.getParameter("value");
            const oEmployeeChangeModel = this.getView().getModel("employeechange");
            const oSelectedEmployee = oEmployeeChangeModel.getProperty("/selectedEmployeeChange");
        
            if (!oSelectedEmployee || sValue !== oSelectedEmployee.Key) {
                this.byId("employeeChangeActing").setValue(oSelectedEmployee ? oSelectedEmployee.Key : "");
                MessageBox.warning("Please select a valid employee from the list.");
            }
        },

        _loadReasonData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Acting");
                oModel.read("/ValueHelpReasonSet", {
                    success: (oData) => {
                        const oReasonModel = new JSONModel(oData.results);
                        this.getView().setModel(oReasonModel, "reason");
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load reason data.");
                        reject(oError);
                    }
                });
            });
        },

        handleValueHelpReason: function() {
            if (!this._oValueHelpDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpReason",
                    controller: this
                }).then(function(oDialog) {
                    this._oValueHelpDialog = oDialog;
                    this._oValueHelpDialog.setModel(this.getView().getModel("reason"), "reason");
                    this.getView().addDependent(this._oValueHelpDialog);
                            
                    this._loadReasonData().then(() => {
                        this._oValueHelpDialog.open();
                    });
                    
                }.bind(this));
            } else {
                this._oValueHelpDialog.open();
            }
        },

        handleSearchReason: function (oEvent) {
            var sValue = oEvent.getParameter("value");
        
            // Create filters for both Key and Value
            var oKeyFilter = new Filter("Key", FilterOperator.Contains, sValue);
            var oValueFilter = new Filter("Value", FilterOperator.Contains, sValue);
        
            // Combine the filters with OR logic
            var oCombinedFilter = new Filter({
                filters: [oKeyFilter, oValueFilter],
                and: false // OR logic
            });
        
            // Apply the combined filter to the binding
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oCombinedFilter]);
        },

        handleCloseReason: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oReasonModel = this.getView().getModel("reason");
                
                oReasonModel.setProperty("/selectedReason", oSelectedItem);
                this.byId("reasonActing").setValue(oSelectedItem.Key);
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        onPositionChange: function(oEvent) {
            // Clear value help selections so fallback to position works
            var oGroupModel = this.getView().getModel("group");
            if (oGroupModel) {
                oGroupModel.setProperty("/selectedGroup", null);
            }
            var oSubGroupModel = this.getView().getModel("subGroup");
            if (oSubGroupModel) {
                oSubGroupModel.setProperty("/selectedSubGroup", null);
            }
            var oAreaModel = this.getView().getModel("area");
            if (oAreaModel) {
                oAreaModel.setProperty("/selectedArea", null);
            }
            var oSubAreaModel = this.getView().getModel("subArea");
            if (oSubAreaModel) {
                oSubAreaModel.setProperty("/selectedSubArea", null);
            }
        },

        _loadPositionData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Acting");
                oModel.read("/ValueHelpPositionSet", {
                    success: (oData) => {
                        const oReasonModel = new JSONModel(oData.results);
                        this.getView().setModel(oReasonModel, "position");
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load position data.");
                        reject(oError);
                    }
                });
            });
        },

        handleValueHelpPosition: function() {
            if (!this._oValueHelpPositionDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpPosition",
                    controller: this
                }).then(function(oDialog) {
                    this._oValueHelpPositionDialog = oDialog;
                    // Bind the employee model to the dialog
                    this._oValueHelpPositionDialog.setModel(this.getView().getModel("position"), "position");
                    this.getView().addDependent(this._oValueHelpPositionDialog);
                            
                    this._loadPositionData().then(() => {
                        this._oValueHelpPositionDialog.open();
                    });
                    
                }.bind(this));
            } else {
                this._oValueHelpPositionDialog.open();
            }
        },

        handleSearchPosition: function (oEvent) {
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

        handleClosePosition: function (oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oPositionModel = this.getView().getModel("position");
                oPositionModel.setProperty("/selectedPosition", oSelectedItem);
                this.byId("PositionIdActing").setValue(oSelectedItem.Key);

                // --- Auto-select group based on position ---
                let oGroupModel = this.getView().getModel("group");
                if (oGroupModel) {
                    let aGroups = oGroupModel.getProperty("/items") || [];
                    let oDefaultGroup = aGroups.find(g => g.Key === oSelectedItem.Key6) || null;
                    oGroupModel.setProperty("/selectedGroup", oDefaultGroup);
                }

                // --- Auto-select area based on position ---
                let oAreaModel = this.getView().getModel("area");
                if (oAreaModel) {
                    let aAreas = oAreaModel.getProperty("/items") || [];
                    let oDefaultArea = aAreas.find(a => a.Key === oSelectedItem.Key4) || null;
                    oAreaModel.setProperty("/selectedArea", oDefaultArea);
                }

                // Always clear sub-group and sub-area selection
                let oSubGroupModel = this.getView().getModel("subGroup");
                if (oSubGroupModel) {
                    oSubGroupModel.setProperty("/selectedSubGroup", null);
                }
                let oSubAreaModel = this.getView().getModel("subArea");
                if (oSubAreaModel) {
                    oSubAreaModel.setProperty("/selectedSubArea", null);
                }
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadAreaData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Acting");
                oModel.read("/ValueHelpArea", {
                    success: (oData) => {
                        const oAreaModel = new sap.ui.model.json.JSONModel({
                            items: oData.results,
                            selectedArea: null
                        });
                        this.getView().setModel(oAreaModel, "area");
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load area data.");
                        reject(oError);
                    }
                });
            });
        },

        handleValueHelpArea: function() {
            if (!this._oValueHelpAreaDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpArea",
                    controller: this
                }).then(function(oDialog) {
                    this._oValueHelpAreaDialog = oDialog;
                    // Bind the area model to the dialog
                    this._oValueHelpAreaDialog.setModel(this.getView().getModel("area"), "area");
                    this.getView().addDependent(this._oValueHelpAreaDialog);
                            
                    this._loadAreaData().then(() => {
                        this._oValueHelpAreaDialog.open();
                    });
                    
                }.bind(this));
            } else {
                this._oValueHelpAreaDialog.open();
            }
        },

        handleSearchArea: function (oEvent) {
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

        handleCloseArea: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oAreaModel = this.getView().getModel("area");
        
                oAreaModel.setProperty("/selectedArea", oSelectedItem);
                this.byId("PerAreaIdActing").setValue(oSelectedItem.Key);
        
                // Clear the selected sub-area when a new area is selected
                let oSubAreaModel = this.getView().getModel("subArea");
                oSubAreaModel.setProperty("/selectedSubArea", {});
                this.byId("PerSubAreaIdActing").setValue("");
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadSubAreaData: function () {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Acting"); // Use the global model
                oModel.read("/ValueHelpSubArea", {
                    success: (oData) => {
                        const oSubAreaModel = this.getOwnerComponent().getModel("subArea");
        
                        if (oSubAreaModel) {
                            // Update the subArea model's data
                            oSubAreaModel.setProperty("/items", oData.results);
                            console.log("SubArea data loaded:", oData.results); // Debugging
                            resolve();
                        } else {
                            console.error("SubArea model is not initialized.");
                            reject("SubArea model is not initialized.");
                        }
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load sub-area data.");
                        reject(oError);
                    }
                });
            });
        },

        handleValueHelpSubArea: function () {
            if (!this._oValueHelpSubAreaDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpSubArea",
                    controller: this
                }).then(function (oDialog) {
                    this._oValueHelpSubAreaDialog = oDialog;
        
                    // Set the subArea model to the dialog
                    const oSubAreaModel = this.getView().getModel("subArea");
                    if (!oSubAreaModel) {
                        console.error("SubArea model is not initialized.");
                        return;
                    }
                    this._oValueHelpSubAreaDialog.setModel(oSubAreaModel, "subArea");
                    this.getView().addDependent(this._oValueHelpSubAreaDialog);
        
                    // Load sub-area data and apply filter
                    this._loadSubAreaData().then(() => {
                        const sSelectedAreaKey = this.getView().getModel("area").getProperty("/selectedArea/Key");
                        if (sSelectedAreaKey) {
                            const oBinding = this._oValueHelpSubAreaDialog.getBinding("items");
                            if (oBinding) {
                                oBinding.filter(new Filter("Key", FilterOperator.EQ, sSelectedAreaKey));
                            }
                        }
                        this._oValueHelpSubAreaDialog.open();
                    });
                }.bind(this));
            } else {
                // Apply filter and open the dialog if it already exists
                const sSelectedAreaKey = this.getView().getModel("area").getProperty("/selectedArea/Key");
                if (sSelectedAreaKey) {
                    const oBinding = this._oValueHelpSubAreaDialog.getBinding("items");
                    if (oBinding) {
                        oBinding.filter(new Filter("Key", FilterOperator.EQ, sSelectedAreaKey));
                    }
                }
                this._oValueHelpSubAreaDialog.open();
            }
        },

        handleSearchSubArea: function (oEvent) {
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

        handleCloseSubArea: function (oEvent) {
            const aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                const oSelectedItem = aContexts[0].getObject();
                const oSubAreaModel = this.getView().getModel("subArea");
        
                if (oSubAreaModel) {
                    // Update the selectedSubArea property
                    oSubAreaModel.setProperty("/selectedSubArea", oSelectedItem);
        
                    // Update the input field with the selected sub-area's Key2
                    this.byId("PerSubAreaIdActing").setValue(oSelectedItem.Key2);
                } else {
                    console.error("SubArea model is not initialized.");
                }
            }
        
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadGroupData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Acting");
                oModel.read("/ValueHelpGrup", {
                    success: (oData) => {
                        const oGroupModel = new sap.ui.model.json.JSONModel({
                            items: oData.results,
                            selectedGroup: null
                        });
                        this.getView().setModel(oGroupModel, "group");
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load group data.");
                        reject(oError);
                    }
                });
            });
        },

        handleValueHelpGroup: function() {
            if (!this._oValueHelpGroupDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpGroup",
                    controller: this
                }).then(function(oDialog) {
                    this._oValueHelpGroupDialog = oDialog;
                    // Bind the area model to the dialog
                    this._oValueHelpGroupDialog.setModel(this.getView().getModel("group"), "group");
                    this.getView().addDependent(this._oValueHelpGroupDialog);
                            
                    this._loadGroupData().then(() => {
                        this._oValueHelpGroupDialog.open();
                    });
                    
                }.bind(this));
            } else {
                this._oValueHelpGroupDialog.open();
            }
        },

        handleSearchGroup: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oFilter = new Filter("Value", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },

        handleCloseGroup: function (oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oGroupModel = this.getView().getModel("group");
        
                if (oGroupModel) {
                    oGroupModel.setProperty("/selectedGroup", oSelectedItem);
                    // oGroupModel.setData({
                    //     ...oGroupModel.getData(),
                    //     selectedGroup: oSelectedItem
                    // });
                    this.byId("EmployeeGroupIdActing").setValue(oSelectedItem.Key);
                } else {
                    console.error("Group model is not initialized.");
                }

                let oSubGroupModel = this.getView().getModel("subGroup");
                if (oSubGroupModel) {
                    let oSubGroupData = oSubGroupModel.getData();
                    if (oSubGroupData) {
                        oSubGroupData.selectedSubGroup = null;
                        oSubGroupModel.setProperty("/selectedSubGroup", null);
                        this.byId("EmployeeSubgroupIdActing").setValue(""); 
                        oSubGroupModel.setData(oSubGroupData);
                    }
                } else {
                    console.error("SubGroup model is not initialized.");
                }
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        onSalaryAdjChange: function (oEvent) {
            const sSelectedKey = oEvent.getSource().getSelectedKey();
            const oModel = this.getView().getModel("dropdown");
        
            if (sSelectedKey === "1") { // "Ya"
                oModel.setProperty("/isSalaryAdjEnabled", true);
            } else if (sSelectedKey === "2") { // "Tidak"
                oModel.setProperty("/isSalaryAdjEnabled", false);
                this.byId("salaryAdjValueActing").setValue(""); // Clear the input value
            }
        },

        onAsFieldChange: function (oEvent) {
            const sSelectedAs = oEvent.getSource().getSelectedKey();
            const oModel = this.getView().getModel("dropdown");
        
            if (sSelectedAs === "1") { 
                oModel.setProperty("/isEmployeeChangeEnabled", false); 
            } else if (sSelectedAs === "2") { 
                oModel.setProperty("/isEmployeeChangeEnabled", true); 
            }

            oModel.setProperty("/selectedAs", sSelectedAs);
        },

        _loadSubGroupData: function () {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Acting");
                oModel.read("/ValueHelpSubGrupSet", {
                    success: (oData) => {
                        const oSubGroupModel = this.getOwnerComponent().getModel("subGroup");
        
                        if (oSubGroupModel) {
                            oSubGroupModel.setProperty("/items", oData.results);
                            console.log("SubGroup data loaded:", oData.results); 
                            resolve();
                        } else {
                            console.error("SubGroup model is not initialized.");
                            reject("SubGroup model is not initialized.");
                        }
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load sub group data.");
                        reject(oError);
                    }
                });
            });
        },
    
        handleValueHelpSubGroup: function () {
            if (!this._oValueHelpSubGroupDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpSubGroup",
                    controller: this
                }).then(function (oDialog) {
                    this._oValueHelpSubGroupDialog = oDialog;
        
                    const oSubGroupModel = this.getView().getModel("subGroup");
                    if (!oSubGroupModel) {
                        console.error("SubGroup model is not initialized.");
                        return;
                    }
                    this._oValueHelpSubGroupDialog.setModel(oSubGroupModel, "subGroup");
                    this.getView().addDependent(this._oValueHelpSubGroupDialog);
        
                    this._loadSubGroupData().then(() => {
                        const sSelectedGroupKey = this.getView().getModel("group").getProperty("/selectedGroup/Key");
                        if (sSelectedGroupKey) {
                            const oBinding = this._oValueHelpSubGroupDialog.getBinding("items");
                            if (oBinding) {
                                oBinding.filter(new Filter("Key", FilterOperator.EQ, sSelectedGroupKey));
                            }
                        }
                        this._oValueHelpSubGroupDialog.open();
                    });
                }.bind(this));
            } else {
                const sSelectedGroupKey = this.getView().getModel("group").getProperty("/selectedGroup/Key");
                if (sSelectedGroupKey) {
                    const oBinding = this._oValueHelpSubGroupDialog.getBinding("items");
                    if (oBinding) {
                        oBinding.filter(new Filter("Key", FilterOperator.EQ, sSelectedGroupKey));
                    }
                }
                this._oValueHelpSubGroupDialog.open();
            }
        },

        handleSearchSubGroup: function (oEvent) {
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

        handleCloseSubGroup: function (oEvent) {
            const aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                const oSelectedItem = aContexts[0].getObject();
                const oSubGroupModel = this.getView().getModel("subGroup");

                if (oSubGroupModel) {
                    oSubGroupModel.setProperty("/selectedSubGroup", oSelectedItem);

                    this.byId("EmployeeSubgroupIdActing").setValue(oSelectedItem.Key2);
                } else {
                    console.error("SubGroup model is not initialized.");
                }
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        onAsFieldChange: function (oEvent) {
            const sSelectedAs = oEvent.getSource().getSelectedKey();
            const oModel = this.getView().getModel("dropdown");
        
            if (sSelectedAs === "1") { 
                oModel.setProperty("/isEmployeeChangeEnabled", false); 
            } else if (sSelectedAs === "2") { 
                oModel.setProperty("/isEmployeeChangeEnabled", true); 
            }

            oModel.setProperty("/selectedAs", sSelectedAs);
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