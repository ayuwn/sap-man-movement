sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/library" 
], function (BaseController, formatter, Fragment, JSONModel, MessageBox, MessageToast, Filter, FilterOperator, CoreLib) {
    "use strict";
    var ValueState = CoreLib.ValueState;

    return BaseController.extend("bsim.hcmapp.man.movement.controller.Assignment", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this.setModel(new JSONModel(), "create");
            this._currentUser();
            this.getRouter().getRoute("assignment").attachPatternMatched(this._onAssignmentRouteMatched, this);

            const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: [] });
            this.getView().setModel(oFileAttachmentModel, "fileAttachment");

            const oViewModel = new JSONModel({
                isSubmitDisabled: false
            });
            this.getView().setModel(oViewModel, "viewModel");

            let oDropdownModel = new JSONModel({
                selectedSalaryAdj: "",
                selectedAs: "",
                isEmployeeChangeEnabled: false,
                isSalaryAdjEnabled: false,

                salaryAdjColl : [
                    { key: "1", text: "Ya"},
                    { key: "2", text: "Tidak"}
                ],

                asColl : [
                    { key: "1", text: "Baru"},
                    { key: "2", text: "Pengganti"}
                ]

            });
            this._oView.setModel(oDropdownModel, "dropdown");

            let oAssessmentAssignmentModel = new JSONModel({
                selectedIndex: 0
            });
            this._oView.setModel(oAssessmentAssignmentModel, "assessmentAssignment");

            let oDisposisiAssignmentModel = new JSONModel({
                selectedIndex: 0
            });
            this._oView.setModel(oDisposisiAssignmentModel, "disposisiAssignment");

            var oDate = new Date();
            oDate.setDate(1);

            var sFormattedEndDate = "9999-12-31";
            var sFormattedDate = oDate.toISOString().split("T")[0];

            this.getView().byId("effectiveDateEndAssignment").setValue(sFormattedEndDate);
            this.getView().byId("effectiveDateStartAssignment").setValue(sFormattedDate);

            let oSubGroupModel = this.getOwnerComponent().getModel("subGroup");
            this.getView().setModel(oSubGroupModel, "subGroup");

            let oSubAreaModel = this.getOwnerComponent().getModel("subArea");
            this.getView().setModel(oSubAreaModel, "subArea");
        },

        // _onAssignmentRouteMatched: function (oEvent) {
        //     const EmployeeNumber = oEvent.getParameter("arguments").EmployeeNumber;
        //     if (EmployeeNumber) {
        //         this._getEmployeeData(EmployeeNumber);
        //     }
        // },

        _onAssignmentRouteMatched: function (oEvent) {
            const oArguments = oEvent.getParameter("arguments") || {};
            const EmployeeNumber = oArguments.EmployeeNumber;
            const oAppModel = this.getModel("appModel");
        
            if (!EmployeeNumber) {
                MessageBox.error("Employee number is missing. Cannot proceed.");
                this.onNavBack();
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel("Assignment");
        
            const oUploadSet = this.byId("idUploadSet");
            if (oUploadSet) {
                oUploadSet.removeAllItems();
            }
            const oFileAttachmentModel = this.getView().getModel("fileAttachment");
            if (oFileAttachmentModel) {
                oFileAttachmentModel.setProperty("/results", []);
            }
        
            // Cek jika ada request yang sedang berjalan
            oModel.read("/RequestSet", {
                filters: [
                    new sap.ui.model.Filter("EmployeeNumber", sap.ui.model.FilterOperator.EQ, EmployeeNumber),
                    new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.NE, "P")
                ],
                success: (oData) => {
                    const aRequests = oData.results || [];
                    const hasPendingRequest = aRequests.some(
                        r => r.EmployeeNumber === EmployeeNumber && r.Status !== "P"
                    );
        
                    if (hasPendingRequest) {
                        MessageBox.error(
                            "A movement request for this employee is already in progress. Please complete it before creating a new one.",
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
                                this.getRouter().navTo("mutation", {
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

        _getEmployeeData: function (EmployeeNumber) {
            // Define paths for EmployeeSet and EmployeeDetailSet
            const sEmployeePath = `/EmployeeSet('${EmployeeNumber}')`;
            const sEmployeeDetailPath = `/EmployeeDetailSet('${EmployeeNumber}')`;
        
            // Get the Assignment OData model
            const oAssignmentModel = this.getOwnerComponent().getModel("Assignment");
        
            if (!oAssignmentModel) {
                console.error("Assignment model is not available.");
                MessageBox.error("System error: Assignment model is not available.");
                return;
            }
        
            let oEmployeeModel = this.getView().getModel("employee");
            let oEmployeeDetailModel = this.getView().getModel("employeeDetail");
        
            this._oBusy.open();
        
            // Fetch EmployeeSet data
            this.readEntityFromModel(oAssignmentModel, sEmployeePath)
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
                    if (!oEmployeeModel) {
                        oEmployeeModel = new sap.ui.model.json.JSONModel();
                        this.getView().setModel(oEmployeeModel, "employee");
                    }
                    oEmployeeModel.setData(employeeResult);
                    console.log("EmployeeSet Data loaded:", employeeResult);
        
                    // Fetch EmployeeDetailSet data
                    return this.readEntityFromModel(oAssignmentModel, sEmployeeDetailPath);
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
                })
                .catch((error) => {
                    console.error("Error loading employee data:", error);
                    MessageBox.error("Error loading employee details");
                })
                .finally(() => {
                    this._oBusy.close();
                });
        },

        readEntityFromModel: function (oModel, sPath) {
            return new Promise((resolve, reject) => {
                oModel.read(sPath, {
                    success: (oData) => {
                        resolve(oData);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

        _currentUser: function () {
            // Show busy indicator
            this._oBusy.open();
        
            var oDataModel = this.getOwnerComponent().getModel(); // Get the default OData model
        
            if (!oDataModel) {
                console.error("OData model not available");
                this._oBusy.close();
                MessageBox.error("System error: OData model not available");
                return;
            }
        
            // Call the EmployeeDetailSet endpoint to get logged-in user details
            oDataModel.read("/EmployeeDetailSet", {
                success: function (oData) {
                    console.log("Current user data received:", oData);
        
                    if (!oData || !oData.results || oData.results.length === 0) {
                        this._oBusy.close();
                        MessageBox.error("No user data received from server");
                        return;
                    }
        
                    // Get the first user from the results
                    var oCurrentUser = oData.results[0];
        
                    // Store the employee ID for later use
                    this._sLoggedInEmployeeId = oCurrentUser.EmployeeNumber;
        
                    // Create a model for current user details
                    var oCurrentUserModel = new sap.ui.model.json.JSONModel(oCurrentUser);
                    this._oView.setModel(oCurrentUserModel, "currentUser");
        
                    this._oBusy.close();
                }.bind(this),
                error: function (oError) {
                    this._oBusy.close();
                    console.error("Error fetching current user data:", oError);
                    MessageBox.error(
                        "Failed to load user details: " +
                        (oError.responseText ? JSON.parse(oError.responseText).error.message.value : "Unknown error")
                    );
                }.bind(this)
            });
        },

        readEntity: function (sPath) {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
                oModel.read(sPath, {
                    success: (oData) => {
                        resolve(oData);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

        _validateEntries: function (oView, sGrpName) {
            let isValid = true;
            let aF = oView.getControlsByFieldGroupId(sGrpName);
        
            for (let i = 0; i < aF.length; i++) {
                try {
                    let oControl = aF[i];
        
                    // Only validate if control is editable (if supported)
                    if (typeof oControl.getEditable === "function" && !oControl.getEditable()) {
                        continue;
                    }
        
                    // Reset control state
                    if (typeof oControl.setValueStateText === "function") {
                        oControl.setValueStateText("");
                    }
                    if (typeof oControl.setValueState === "function") {
                        oControl.setValueState("None");
                    }
        
                    // Always use "This field" as the label
                    let sLabel = "This field";
        
                    // Determine if the field is required.
                    let bRequired = false;
                    if (typeof oControl.getRequired === "function") {
                        bRequired = oControl.getRequired();
                    }
        
                    // Determine if the control's value is empty
                    let isEmpty = false;
                    let sControlType = oControl.getMetadata().getName();
                    if (bRequired) {
                        if (sControlType === "sap.m.Select") {
                            isEmpty = !oControl.getSelectedKey();
                        } else if (typeof oControl.getValue === "function") {
                            let sValue = oControl.getValue();
                            isEmpty = !sValue || !sValue.trim();
                        }
                    }
        
                    // Set error state if required value is empty
                    if (bRequired && isEmpty) {
                        isValid = false;
                        if (typeof oControl.setValueStateText === "function") {
                            oControl.setValueStateText(sLabel + " is required!");
                        }
                        if (typeof oControl.setValueState === "function") {
                            oControl.setValueState("Error");
                        }
                    } else {
                        // Additional check for TextArea length
                        if (sControlType === "sap.m.TextArea" && typeof oControl.getValue === "function") {
                            let iMaxLength = oControl.getMaxLength();
                            let sValue = oControl.getValue();
                            if (iMaxLength && sValue.length > iMaxLength) {
                                isValid = false;
                                oControl.setValueStateText(sLabel + " is too long!");
                                oControl.setValueState("Error");
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Validation error for control:", e);
                    isValid = false;
                }
            }
        
            if (!isValid) {
                sap.m.MessageToast.show(this.getResourceBundle().getText("msgFillRequired"));
            }
        
            return isValid;
        },

        onDisplayDocumentWarning: function () {
            const oEmployeeModel = this.getView().getModel("employee");
            const oEmployeeDetailModel = this.getView().getModel("employeeDetail");
        
            // Attempt to get EmployeeNumber from employee model
            let sEmployeeNumber = oEmployeeModel ? oEmployeeModel.getProperty("/EmployeeNumber") : null;
            console.warn("EmployeeNumber from 'employee' model:", sEmployeeNumber);
        
            // If not found, fallback to employeeDetail model
            if (!sEmployeeNumber) {
                sEmployeeNumber = oEmployeeDetailModel ? oEmployeeDetailModel.getProperty("/EmployeeNumber") : null;
                console.warn("EmployeeNumber from 'employeeDetail' model:", sEmployeeNumber);
            }
        
            if (!sEmployeeNumber) {
                console.error("Employee number is missing in both 'employee' and 'employeeDetail' models.");
                sap.m.MessageBox.error("Employee number is missing. Cannot fetch document.");
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel("Grievances"); // Access the Grievances model
            if (!oModel) {
                console.error("Grievances model is not available.");
                sap.m.MessageBox.error("System error: Grievances model is not available.");
                return;
            }
        
            console.warn("Fetching requests for EmployeeNumber:", sEmployeeNumber);
        
            // Step 1: Fetch requests matching the employee number
            oModel.read("/RequestSet", {
                filters: [new sap.ui.model.Filter("EmployeeNumber", sap.ui.model.FilterOperator.EQ, sEmployeeNumber)],
                urlParameters: {
                    "$orderby": "CreatedOn desc" // Sort by CreatedOn descending
                },
                success: (oData) => {
                    console.warn("Requests fetched successfully:", oData);
        
                    if (!oData.results || oData.results.length === 0) {
                        console.warn("No requests found for EmployeeNumber:", sEmployeeNumber);
                        sap.m.MessageBox.error("No requests found for the given employee.");
                        return;
                    }
        
                    // Step 2: Get the most recent request
                    const oLatestRequest = oData.results[0];
                    const sRequestGUID = oLatestRequest.RequestId;
                    console.warn("Most recent RequestId:", sRequestGUID);
        
                    // Step 3: Expand to toAttachmentView
                    const sExpandPath = `/RequestSet(guid'${sRequestGUID}')/toAttachmentView`;
                    console.warn("Expanding to path:", sExpandPath);
        
                    oModel.read(sExpandPath, {
                        success: (oAttachmentData) => {
                            console.warn("Attachments fetched successfully:", oAttachmentData);
        
                            if (!oAttachmentData.results || oAttachmentData.results.length === 0) {
                                console.warn("No attachments found for RequestId:", sRequestGUID);
                                sap.m.MessageBox.error("No attachments found for the latest request.");
                                return;
                            }
        
                            // Step 4: Find the document with the latest SequenceNo
                            const oLatestAttachment = oAttachmentData.results.reduce((latest, current) => {
                                return current.SequenceNo > latest.SequenceNo ? current : latest;
                            });
        
                            console.warn("Latest attachment:", oLatestAttachment);
        
                            if (!oLatestAttachment || !oLatestAttachment.Url) {
                                console.warn("No valid document URL found in the attachments for RequestId:", sRequestGUID);
                                sap.m.MessageBox.error("No valid document URL found in the attachments.");
                                return;
                            }
        
                            // Step 5: Display the document
                            const sDocumentUrl = oLatestAttachment.Url;
                            console.warn("Opening document URL:", sDocumentUrl);
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

        onSalaryAdjChange: function (oEvent) {
            const sSelectedKey = oEvent.getSource().getSelectedKey();
            const oModel = this.getView().getModel("dropdown");
        
            if (sSelectedKey === "1") { // "Ya"
                oModel.setProperty("/isSalaryAdjEnabled", true);
            } else if (sSelectedKey === "2") { // "Tidak"
                oModel.setProperty("/isSalaryAdjEnabled", false);
                this.byId("salaryAdjValueAssignment").setValue(""); // Clear the input value
            }
        },

        handleLiveChange: function (oEvent) {
            var oTextArea = oEvent.getSource(),
                iValueLength = oTextArea.getValue().length,
                iMaxLength = oTextArea.getMaxLength(),
                sState = iValueLength > iMaxLength ? ValueState.Warning : ValueState.None;

            oTextArea.setValueState(sState);
        },

        onSendRequest: function () {
            // Get employee model
            let oEmployeeModel = this.getView().getModel("employee");
            console.log("Employee Model Data:", oEmployeeModel.getData());
            let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
            let oSelectedEmpSupervisor = oEmployeeModel.getProperty("/Supervisor");
        
            // Get the logged-in user's employee number
            let oCurrentUserModel = this.getView().getModel("currentUser");
            let sLoggedInEmployeeId = oCurrentUserModel ? oCurrentUserModel.getProperty("/EmployeeNumber") : null;
        
            console.log("Selected Employee:", oSelectedEmp);
            console.log("Selected Employee's Supervisor:", oSelectedEmpSupervisor);
            console.log("Logged-in User's Employee ID:", sLoggedInEmployeeId);
        
            if (!oSelectedEmp) {
                MessageBox.error("Please select an employee first.");
                return;
            }
        
            if (!sLoggedInEmployeeId) {
                MessageBox.error("Unable to retrieve logged-in user details.");
                return;
            }
        
            // Ensure the user cannot perform actions on themselves
            if (oSelectedEmp === sLoggedInEmployeeId) {
                MessageBox.error("You cannot perform actions on yourself.");
                return;
            }
        
            // Check if the logged-in user is a supervisor of the selected employee
            if (oSelectedEmpSupervisor !== sLoggedInEmployeeId) {
                MessageBox.error("You are not authorized to perform this action on the selected employee.");
                return;
            }
        
            // Validate required entries
            var oView = this.getView();
            if (!this._validateEntries(oView, "grpValidation")) {
                return;
            }

            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/isSubmitDisabled", true);
        
            // Confirm with user before sending
            MessageBox.confirm("Do you want to submit this request?", {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                initialFocus: MessageBox.Action.NO,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.YES) {
                        this._postAssignmentRequest();
                    } else {
                        return false;
                    }
                }
            });
        },

        _postAssignmentRequest: function () {
            const oEmployeeModel = this.getView().getModel("employee");
            const oEmployeeDetailModel = this.getView().getModel("employeeDetail");
            const oCurrentUserModel = this.getView().getModel("currentUser");
        
            if (!oEmployeeModel || !oCurrentUserModel) {
                MessageBox.error("Required models are not available.");
                return;
            }
        
            const oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
            const sLoggedInEmployeeId = oCurrentUserModel.getProperty("/EmployeeNumber");

            const oPlansReqDesc = oCurrentUserModel.getProperty("/EmployeePositionLongtext");
            const oNamaKantorReq = oCurrentUserModel.getProperty("/NamaKantorReq");
            const oDivisiDescReq = oCurrentUserModel.getProperty("/DivisionText");

            const sBeginDate = oEmployeeDetailModel.getProperty("/BeginDate");

            const oDropdownModel = this.getView().getModel("dropdown");
            const sSelectedAs = oDropdownModel.getProperty("/selectedAs") || "";
        
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
        
            const oPayload = {
                RequestId: "00000000-0000-0000-0000-000000000000",
                EmployeeNumber: oSelectedEmp,
                Status: "S",
                PicNumber: sLoggedInEmployeeId,
                Massg: this.byId("reasonAssignment").getValue(),
                MassgDesc: this.byId("reasonTextAssignment").getText(),
                BeginDate: getFormattedDate("actDateStartAssignment"),
                EndDate: getFormattedDate("actDateEndAssignment"),
                StartDate: sBeginDate,
                ZbegdaEfktf: getFormattedDate("effectiveDateStartAssignment"),
                ZenddaEfktf: getFormattedDate("effectiveDateEndAssignment"),
                PlansDest: this.byId("newPositionIdAssignment").getValue(),
                PlansDesc_Dest: this.byId("newPositionTextAssignment").getText(),
                PersgDest: this.byId("newEmployeeGroupIdAssignment").getValue(),
                PersgDestDesc: this.byId("newEmployeeGroupTextAssignment").getText(),
                PerskDest: this.byId("newEmployeeSubgroupIdAssignment").getValue(),
                PerskDestDesc: this.byId("newEmployeeSubgroupTextAssignment").getText(),
                WerksDest: this.byId("newPerAreaIdAssignment").getValue(),
                WerksDestDesc: this.byId("newPerAreaTextAssignment").getText(),
                BtrtlDest: this.byId("newPerSubAreaIdAssignment").getValue(),
                BtrtlDestDesc: this.byId("newPerSubAreaTextAssignment").getText(),
                // Adjstmn: this.getView().getModel("dropdown").getProperty("/selectedSalaryAdj") || "",
                // Zsalary: this.byId("salaryAdjValueAssignment").getValue() ? this.byId("salaryAdjValueAssignment").getValue().replace(/\D/g, '') : "0",
                Zdasar1: sSelectedAs,
                Zexholder: this.byId("employeeChangeAssignment").getValue(),
                ZexholderDesc: this.byId("employeeChangeTextAssignment").getText(),
                Zdasar2: this.byId("basicConAssignment").getValue(),
                PlansAsl: this.byId("currentPositionIdAssignment").getValue(),
                PlansDescAsl: this.byId("currentPositionTextAssignment").getText(),
                WerksAsl: this.byId("currentPerAreaIdAssignment").getValue(), 
                WerksDescAsl: this.byId("currentPerAreaTextAssignment").getText(),
                BtrtlAsl: this.byId("currentPerSubAreaIdAssignment").getValue(),
                BtrtlDescAsl: this.byId("currentPerSubAreaTextAssignment").getText(),
                OuAsl: this.byId("currentUnitOrgIdAssignment").getValue(),
                OuDecAsl: this.byId("currentUnitOrgTextAssignment").getText(),
                OuDest: this.byId("newUnitOrgIdAssignment").getValue(),
                OuDescDest: this.byId("newUnitOrgTextAssignment").getText(),
                DivisiAsl: this.byId("currentDivisionIdAssignment").getValue(),
                DivisiDescAsl: this.byId("currentDivisionTextAssignment").getText(), 
                DivisiDest: this.byId("newDivisionIdAssignment").getValue(),
                DivisiDescDest: this.byId("newDivisionTextAssignment").getText(),
                PlansReqDesc: oPlansReqDesc,
                NamaKantorReq: oNamaKantorReq,
                DivisiDescReq: oDivisiDescReq
            };
        
            console.log("Assignment Payload:", oPayload);
        
            // Show busy dialog
            if (!this._oBusyDialog) {
                this._oBusyDialog = new sap.m.BusyDialog();
            }
            this._oBusyDialog.setTitle("Please wait...");
            this._oBusyDialog.setText("Submitting request...");
            this._oBusyDialog.open();
        
            // Submit Assignment data to the Assignment OData service
            const oModel = this.getOwnerComponent().getModel("Assignment");
            oModel.create("/RequestSet", oPayload, {
                success: (oData) => {
                    this._oBusyDialog.close();
                    MessageBox.success("Request has been submitted successfully.", {
                        onClose: () => {
                            // Navigate to history view after success
                            this.getRouter().navTo("history");
                        }
                    });
                },
                error: (oError) => {
                    this._oBusyDialog.close();
                    if (oError) {
                        try {
                            const oErrorMessage = JSON.parse(oError.responseText);
                            MessageBox.error(oErrorMessage.error.message.value);
                        } catch (e) {
                            MessageBox.error("Error submitting Assignment request: " + oError.message);
                        }
                    } else {
                        MessageBox.error("Unknown error occurred while submitting Assignment request.");
                    }
                }
            });
        },

        _loadEmployeeChangeData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Assignment");
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
            var oFilter = new Filter("EmployeeNumber", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },

        handleCloseEmployeeChange: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oEmployeeChangeModel = this.getView().getModel("employeechange");
                
                oEmployeeChangeModel.setProperty("/selectedEmployeeChange", oSelectedItem);
                this.byId("employeeChangeAssignment").setValue(oSelectedItem.Key);
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadReasonData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Assignment");
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
                this.byId("reasonAssignment").setValue(oSelectedItem.Key);
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
                const oModel = this.getOwnerComponent().getModel("Assignment");
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
        
            // Create filters for both Key and Value
            var oKeyFilter = new Filter("Key", FilterOperator.Contains, sValue);
            var oValueFilter = new Filter("Value", FilterOperator.Contains, sValue);
        
            // Combine the filters with OR logic
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
                this.byId("newPositionIdAssignment").setValue(oSelectedItem.Key);

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

        // handleClosePosition: function(oEvent) {
        //     let aContexts = oEvent.getParameter("selectedContexts");
        //     if (aContexts && aContexts.length) {
        //         let oSelectedItem = aContexts[0].getObject();
        //         let oPositionModel = this.getView().getModel("position");
                
        //         oPositionModel.setProperty("/selectedPosition", oSelectedItem);
        //         this.byId("newPositionIdAssignment").setValue(oSelectedItem.Key);
        //     }
        //     oEvent.getSource().getBinding("items").filter([]);
        // },

        _loadAreaData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Assignment");
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
                this.byId("newPerAreaIdAssignment").setValue(oSelectedItem.Key);
        
                // Clear the selected sub-area when a new area is selected
                let oSubAreaModel = this.getView().getModel("subArea");
                oSubAreaModel.setProperty("/selectedSubArea", {});
                this.byId("newPerSubAreaIdAssignment").setValue("");
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadSubAreaData: function () {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Assignment"); // Use the global model
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
                    this.byId("newPerSubAreaIdAssignment").setValue(oSelectedItem.Key2);
                } else {
                    console.error("SubArea model is not initialized.");
                }
            }
        
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadGroupData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
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
                    this.byId("newEmployeeGroupIdAssignment").setValue(oSelectedItem.Key);
                } else {
                    console.error("Group model is not initialized.");
                }

                let oSubGroupModel = this.getView().getModel("subGroup");
                if (oSubGroupModel) {
                    let oSubGroupData = oSubGroupModel.getData();
                    if (oSubGroupData) {
                        oSubGroupData.selectedSubGroup = null;
                        oSubGroupModel.setProperty("/selectedSubGroup", null);
                        this.byId("newEmployeeSubgroupIdAssignment").setValue(""); 
                        oSubGroupModel.setData(oSubGroupData);
                    }
                } else {
                    console.error("SubGroup model is not initialized.");
                }
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadSubGroupData: function () {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("Assignment");
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

                    this.byId("newEmployeeSubgroupIdAssignment").setValue(oSelectedItem.Key2);
                } else {
                    console.error("SubGroup model is not initialized.");
                }
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        onAsFieldChange: function (oEvent) {
            const sSelectedAs = oEvent.getSource().getSelectedKey(); 
            const oModel = this.getView().getModel("dropdown"); 
        
            if (sSelectedAs === "1") { // 
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
                oRouter.navTo("orgchart", {}, true);
            }
        }
    });
});