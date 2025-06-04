sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/core/library" 
], function (BaseController, formatter, JSONModel, MessageBox, MessageToast, Filter, FilterOperator, Fragment, CoreLib) {
    "use strict";
    var ValueState = CoreLib.ValueState;

    return BaseController.extend("bsim.hcmapp.man.movement.controller.StatusChange", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this.setModel(new JSONModel(), "create");
            this._currentUser();
            this.getRouter().getRoute("statuschange").attachPatternMatched(this._onStatusChangeRouteMatched, this);

            let oEmployeeModel = new JSONModel({
            });
            this.getView().setModel(oEmployeeModel, "employee");

            var oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: [] });
            this.getView().setModel(oFileAttachmentModel, "fileAttachment");
            // const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: [] });
            // this.getView().setModel(oFileAttachmentModel, "fileAttachment");

            let oDropdownModel = new JSONModel({
                selectedSalaryAdj: "",
                selectedAs: "1",
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

            let oAssessmentStatusModel = new JSONModel({
                selectedIndex: 0
            });
            this._oView.setModel(oAssessmentStatusModel, "assessmentStatus");

            let oDisposisiStatusModel = new JSONModel({
                selectedIndex: 0
            });
            this._oView.setModel(oDisposisiStatusModel, "disposisiStatus");

            var oDate = new Date();
            oDate.setDate(1);

            var sFormattedEndDate = "9999-12-31";
            var sFormattedDate = oDate.toISOString().split("T")[0];

            this.getView().byId("effectiveDateEndStatusChange").setValue(sFormattedEndDate);
            this.getView().byId("effectiveDateStartStatusChange").setValue(sFormattedDate);

            const oViewModel = new JSONModel({
                isSubmitDisabled: false
            });
            this.getView().setModel(oViewModel, "viewModel");

            var oHomebaseInput = this.byId("homebaseTujuanStatusChange");
            if (oHomebaseInput) {
                oHomebaseInput.setEditable(false);
            }

            var oSalaryAdjInput = this.byId("salaryAdjValueStatusChange");
            if (oSalaryAdjInput) {
                oSalaryAdjInput.setEnabled(false);
            }
            var oSalaryAdjSelect = this.byId("salaryAdjStatusChange");
            if (oSalaryAdjSelect) {
                oSalaryAdjSelect.setEnabled(false);
            }

            var oValidDateStart = this.byId("validDateStartStatusChange");
            if (oValidDateStart) {
                oValidDateStart.setEditable(false);
            }

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

            // oGrievancesModel.read("/RequestSet", {
            //     urlParameters: {
            //         "$expand": "toAttachmentView", // Expand toAttachmentView
            //         "$orderby": "CreatedOn desc, CreatedAt desc" // Sort by CreatedOn and CreatedAt descending
            //     },
            //     success: (oData) => {
            //         console.log("Grievances data with attachments loaded successfully:", oData);
            
            //         const aRequests = oData.results || [];
            //         const sEmployeeNumber = this.getView().getModel("employee").getProperty("/EmployeeNumber");
            
            //         if (!sEmployeeNumber) {
            //             console.error("Employee number is missing in the 'employee' model.");
            //             // sap.m.MessageBox.error("Employee number is missing. Cannot fetch document.");
            //             return;
            //         }
            
            //         const aFilteredRequests = aRequests.filter(request => request.EmployeeNumber === sEmployeeNumber);
            
            //         if (aFilteredRequests.length === 0) {
            //             console.warn(`No requests found for EmployeeNumber: ${sEmployeeNumber}`);
            //             // Set hasRequest to false and hide the button
            //             const oAttachmentModel = new sap.ui.model.json.JSONModel({ hasRequest: false });
            //             this.getView().setModel(oAttachmentModel, "FilteredAttachments");
            //             return;
            //         }
            
            //         const oLatestRequest = aFilteredRequests[0]; // The first request is the newest due to sorting
            //         console.log("Most recent request:", oLatestRequest);
            
            //         // Process attachments from the newest request
            //         const aAttachments = oLatestRequest.toAttachmentView?.results || [];
            //         const aFilteredAttachments = aAttachments.filter(attachment => attachment.TypeDoc === "ST/SP Baru");
            
            //         const oAttachmentModel = new sap.ui.model.json.JSONModel({
            //             hasRequest: aFilteredAttachments.length > 0,
            //             attachments: aFilteredAttachments
            //         });
            //         this.getView().setModel(oAttachmentModel, "FilteredAttachments");
            
            //         if (aFilteredAttachments.length > 0) {
            //             console.log("Filtered Attachments with TypeDoc 'ST/SP Baru':", aFilteredAttachments);
            //         } else {
            //             console.warn("No attachments with TypeDoc 'ST/SP Baru' found.");
            //         }
            //     },
            //     error: (oError) => {
            //         console.error("Error loading grievances data with attachments:", oError);
            //         const oAttachmentModel = new sap.ui.model.json.JSONModel({ hasRequest: false });
            //         this.getView().setModel(oAttachmentModel, "FilteredAttachments");
            //     }
            // });

            // Refresh the page only once per session when first accessing the status change page
            if (!sessionStorage.getItem("statusChangeFirstLoad")) {
                sessionStorage.setItem("statusChangeFirstLoad", "true");
                location.reload();
                return; // Prevent further execution after reload
            }

            this._loadPerformanceData();
            this._loadEvaluasiData();
        },

        _onStatusChangeRouteMatched: function (oEvent) {
            this._clearStatusChangeForm();
            const oArguments = oEvent.getParameter("arguments") || {};
            const EmployeeNumber = oArguments.EmployeeNumber;
            const oAppModel = this.getModel("appModel");
        
            if (!EmployeeNumber) {
                MessageBox.error("Employee number is missing. Cannot proceed.");
                this.onNavBack();
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel("StatusChange");
        
            var oUploadSet = this.byId("idUploadStatChange");
            if (oUploadSet) {
                oUploadSet.removeAllItems();
            }
            var oFileAttachmentModel = this.getView().getModel("fileAttachment");
            if (oFileAttachmentModel) {
                oFileAttachmentModel.setProperty("/results", []);
            }
        
            // Cek jika ada request yang sedang berjalan
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
                            "Permintaan perubahan status untuk karyawan ini sedang diproses. Harap selesaikan terlebih dahulu sebelum membuat permintaan baru.",
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
                                this.getRouter().navTo("statuschange", {
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

        _clearStatusChangeForm: function () {
            // Clear employee model
            let oEmployeeModel = this.getView().getModel("employee");
            if (oEmployeeModel) oEmployeeModel.setData({});

            // Clear employee detail model
            let oEmployeeDetailModel = this.getView().getModel("employeeDetail");
            if (oEmployeeDetailModel) oEmployeeDetailModel.setData({});

            // Clear file attachments
            let oFileAttachmentModel = this.getView().getModel("fileAttachment");
            if (oFileAttachmentModel) oFileAttachmentModel.setProperty("/results", []);

            
            // Remove all items from the upload set control
            var oUploadSet = this.byId("idUploadStatChange");
            if (oUploadSet && typeof oUploadSet.removeAllItems === "function") {
                oUploadSet.removeAllItems();
            }

            // Clear dropdown selections
            let oDropdownModel = this.getView().getModel("dropdown");
            if (oDropdownModel) {
                oDropdownModel.setProperty("/selectedSalaryAdj", "");
                oDropdownModel.setProperty("/selectedAs", "1");
                oDropdownModel.setProperty("/isEmployeeChangeEnabled", false);
                oDropdownModel.setProperty("/isSalaryAdjEnabled", false);
            }

            // Clear assessment and disposisi status
            let oAssessmentStatusModel = this.getView().getModel("assessmentStatus");
            if (oAssessmentStatusModel) oAssessmentStatusModel.setProperty("/selectedIndex", 0);

            let oDisposisiStatusModel = this.getView().getModel("disposisiStatus");
            if (oDisposisiStatusModel) oDisposisiStatusModel.setProperty("/selectedIndex", 0);

            // Clear input fields by ID
            [
                "KontrakStatusChange",
                "kontrakTextStatusChange",
                "actDateStartStatusChange",
                "actDateEndStatusChange",
                "effectiveDateStartStatusChange",
                "effectiveDateEndStatusChange",
                "validDateStartStatusChange",
                "totalNilaiStatusChange",
                "salaryAdjValueStatusChange",
                "basicConStatusChange",
                "homebaseTujuanStatusChange",
                "homebaseTujuanTextStatusChange",
                "hasilperformStatusChange",
                "kategoriEvaluasiStatusChange",
                "idUploadStatChange"
            ].forEach(function (sId) {
                var oControl = this.byId(sId);
                if (oControl && typeof oControl.setValue === "function") {
                    oControl.setValue("");
                }
                if (oControl && typeof oControl.setText === "function") {
                    oControl.setText("");
                }
                if (oControl && typeof oControl.setDateValue === "function") {
                    oControl.setDateValue(null);
                }
            }.bind(this));
        },

        _getEmployeeData: function (EmployeeNumber) {
            return new Promise((resolve, reject) => {
            // Define paths for EmployeeSet and EmployeeDetailSet
            const sEmployeePath = `/EmployeeSet('${EmployeeNumber}')`;
            const sEmployeeDetailPath = `/EmployeeDetailSet('${EmployeeNumber}')`;
        
            // Get the Status OData model
            const oStatusChangeModel = this.getOwnerComponent().getModel("StatusChange");
        
            if (!oStatusChangeModel) {
                console.error("Status Change model is not available.");
                MessageBox.error("System error: Status Change model is not available.");
                return;
            }
        
            let oEmployeeModel = this.getView().getModel("employee");
            let oEmployeeDetailModel = this.getView().getModel("employeeDetail");
        
            this._oBusy.open();
        
            // Fetch EmployeeSet data
            this.readEntityFromModel(oStatusChangeModel, sEmployeePath)
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
                    resolve();
                })
                .catch((error) => {
                    console.error("Error loading employee data:", error);
                    MessageBox.error("Error loading employee details");
                    reject(error);
                })
                .finally(() => {
                    this._oBusy.close();
                });
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
        
            var oDataModel = this.getOwnerComponent().getModel("StatusChange"); // Get the default OData model
        
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

        readEntity: function (sPath) {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("StatusChange");
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

        // onDisplayDocumentWarning: function () {
        //     const oEmployeeModel = this.getView().getModel("employee");
        //     const oEmployeeDetailModel = this.getView().getModel("employeeDetail");
        
        //     // Attempt to get EmployeeNumber from employee model
        //     let sEmployeeNumber = oEmployeeModel ? oEmployeeModel.getProperty("/EmployeeNumber") : null;
        //     console.warn("EmployeeNumber from 'employee' model:", sEmployeeNumber);
        
        //     // If not found, fallback to employeeDetail model
        //     if (!sEmployeeNumber) {
        //         sEmployeeNumber = oEmployeeDetailModel ? oEmployeeDetailModel.getProperty("/EmployeeNumber") : null;
        //         console.warn("EmployeeNumber from 'employeeDetail' model:", sEmployeeNumber);
        //     }
        
        //     if (!sEmployeeNumber) {
        //         console.error("Employee number is missing in both 'employee' and 'employeeDetail' models.");
        //         sap.m.MessageBox.error("Employee number is missing. Cannot fetch document.");
        //         return;
        //     }
        
        //     const oModel = this.getOwnerComponent().getModel("Grievances"); // Access the Grievances model
        //     if (!oModel) {
        //         console.error("Grievances model is not available.");
        //         sap.m.MessageBox.error("System error: Grievances model is not available.");
        //         return;
        //     }
        
        //     console.warn("Fetching requests for EmployeeNumber:", sEmployeeNumber);
        
        //     // Step 1: Fetch requests matching the employee number
        //     oModel.read("/RequestSet", {
        //         filters: [new sap.ui.model.Filter("EmployeeNumber", sap.ui.model.FilterOperator.EQ, sEmployeeNumber)],
        //         urlParameters: {
        //             "$orderby": "CreatedOn desc" // Sort by CreatedOn descending
        //         },
        //         success: (oData) => {
        //             console.warn("Requests fetched successfully:", oData);
        
        //             if (!oData.results || oData.results.length === 0) {
        //                 console.warn("No requests found for EmployeeNumber:", sEmployeeNumber);
        //                 sap.m.MessageBox.error("No requests found for the given employee.");
        //                 return;
        //             }
        
        //             // Step 2: Get the most recent request
        //             const oLatestRequest = oData.results[0];
        //             const sRequestGUID = oLatestRequest.RequestId;
        //             console.warn("Most recent RequestId:", sRequestGUID);
        
        //             // Step 3: Expand to toAttachmentView
        //             const sExpandPath = `/RequestSet(guid'${sRequestGUID}')/toAttachmentView`;
        //             console.warn("Expanding to path:", sExpandPath);
        
        //             oModel.read(sExpandPath, {
        //                 success: (oAttachmentData) => {
        //                     console.warn("Attachments fetched successfully:", oAttachmentData);
        
        //                     if (!oAttachmentData.results || oAttachmentData.results.length === 0) {
        //                         console.warn("No attachments found for RequestId:", sRequestGUID);
        //                         sap.m.MessageBox.error("No attachments found for the latest request.");
        //                         return;
        //                     }
        
        //                     // Step 4: Find the document with the latest SequenceNo
        //                     const oLatestAttachment = oAttachmentData.results.reduce((latest, current) => {
        //                         return current.SequenceNo > latest.SequenceNo ? current : latest;
        //                     });
        
        //                     console.warn("Latest attachment:", oLatestAttachment);
        
        //                     if (!oLatestAttachment || !oLatestAttachment.Url) {
        //                         console.warn("No valid document URL found in the attachments for RequestId:", sRequestGUID);
        //                         sap.m.MessageBox.error("No valid document URL found in the attachments.");
        //                         return;
        //                     }
        
        //                     // Step 5: Display the document
        //                     const sDocumentUrl = oLatestAttachment.Url;
        //                     console.warn("Opening document URL:", sDocumentUrl);
        //                     window.open(sDocumentUrl, "_blank");
        //                 },
        //                 error: (oError) => {
        //                     console.error("Error fetching attachments:", oError);
        //                     sap.m.MessageBox.error("Failed to fetch attachments for the latest request.");
        //                 }
        //             });
        //         },
        //         error: (oError) => {
        //             console.error("Error fetching requests:", oError);
        //             sap.m.MessageBox.error("Failed to fetch requests for the given employee.");
        //         }
        //     });
        // },

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

        onSendRequest: function () {
            let oEmployeeModel = this.getView().getModel("employee");
            console.log("Employee Model Data:", oEmployeeModel.getData());
            let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
            let oSelectedEmpSupervisor = oEmployeeModel.getProperty("/Supervisor");

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

            // Check reason
            var sReasonKey = this.byId("reasonStatusChange").getValue();

            // Mandatory upload check, except for reason 03
            var oFileAttachmentModel = this.getView().getModel("fileAttachment");
            var aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
            if (sReasonKey !== "03" && (!aFiles || aFiles.length === 0)) {
                MessageBox.error("Mohon unggah dokumen yang diperlukan.");
                return;
            }

            // Confirm with user before sending
            MessageBox.confirm("Apakah Anda sudah yakin untuk melakukan pengajuan ini?", {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                initialFocus: MessageBox.Action.NO,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.YES) {
                        const oViewModel = this.getView().getModel("viewModel");
                        oViewModel.setProperty("/isSubmitDisabled", true);
                        this._postStatusChangeRequest();
                    } else {
                        return false;
                    }
                }
            });
        },

        // onSendRequest: function () {
        //     let oEmployeeModel = this.getView().getModel("employee");
        //     console.log("Employee Model Data:", oEmployeeModel.getData());
        //     let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
        //     let oSelectedEmpSupervisor = oEmployeeModel.getProperty("/Supervisor");
        
        //     let oCurrentUserModel = this.getView().getModel("currentUser");
        //     let sLoggedInEmployeeId = oCurrentUserModel ? oCurrentUserModel.getProperty("/EmployeeNumber") : null;
        
        //     console.log("Selected Employee:", oSelectedEmp);
        //     console.log("Selected Employee's Supervisor:", oSelectedEmpSupervisor);
        //     console.log("Logged-in User's Employee ID:", sLoggedInEmployeeId);
        
        //     if (!oSelectedEmp) {
        //         MessageBox.error("Please select an employee first.");
        //         return;
        //     }
        
        //     if (!sLoggedInEmployeeId) {
        //         MessageBox.error("Unable to retrieve logged-in user details.");
        //         return;
        //     }
        
        //     // Ensure the user cannot perform actions on themselves
        //     if (oSelectedEmp === sLoggedInEmployeeId) {
        //         MessageBox.error("You cannot perform actions on yourself.");
        //         return;
        //     }
        
        //     // Check if the logged-in user is a supervisor of the selected employee
        //     if (oSelectedEmpSupervisor !== sLoggedInEmployeeId) {
        //         MessageBox.error("You are not authorized to perform this action on the selected employee.");
        //         return;
        //     }
        
        //     // Validate required entries
        //     var oView = this.getView();
        //     if (!this._validateEntries(oView, "grpValidation")) {
        //         return;
        //     }

        //     // Mandatory upload check
        //     var oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     var aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        //     if (!aFiles || aFiles.length === 0) {
        //         MessageBox.error("Mohon unggah dokumen yang diperlukan.");
        //         return;
        //     }

        //     // Confirm with user before sending
        //     MessageBox.confirm("Apakah Anda sudah yakin untuk melakukan pengajuan ini?", {
        //         actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        //         emphasizedAction: MessageBox.Action.NO,
        //         initialFocus: MessageBox.Action.NO,
        //         onClose: (sAction) => {
        //             if (sAction === MessageBox.Action.YES) {
        //                  const oViewModel = this.getView().getModel("viewModel");
        //                 oViewModel.setProperty("/isSubmitDisabled", true);
        //                 this._postStatusChangeRequest();
        //             } else {
        //                 return false;
        //             }
        //         }
        //     });
        // },

        _postStatusChangeRequest: function () {
            const oEmployeeModel = this.getView().getModel("employee");
            const oEmployeeDetailModel = this.getView().getModel("employeeDetail");
            const oCurrentUserModel = this.getView().getModel("currentUser");
        
            if (!oEmployeeModel || !oCurrentUserModel) {
                MessageBox.error("Required models are not available.");
                return;
            }

            var oView = this.getView();
            if (!this._validateEntries(oView, "grpValidation")) {
                return;
            }

            var sReasonKey = this.byId("reasonStatusChange").getValue();
            var oFileAttachmentModel = this.getView().getModel("fileAttachment");
            var aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
            if (sReasonKey !== "03" && (!aFiles || aFiles.length === 0)) {
                MessageBox.error("Mohon unggah dokumen yang diperlukan.");
                return;
            }

            // var oFileAttachmentModel = this.getView().getModel("fileAttachment");
            // var aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
            // if (!aFiles || aFiles.length === 0) {
            //     MessageBox.error("Mohon unggah dokumen yang diperlukan.");
            //     return;
            // }
        
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
        
            const oPayload = {
                RequestId: "00000000-0000-0000-0000-000000000000",
                EmployeeNumber: oSelectedEmp,
                Status: "S",
                PicNumber: sLoggedInEmployeeId,
                Massg: this.byId("reasonStatusChange").getValue(),
                MassgDesc: this.byId("reasonTextStatusChange").getText(),
                TipeKontrakAsl: this.byId("CurrentTipeKontrakStatusChange").getValue(),
                TipeKontrakDescAsl: this.byId("CurrentTipeKontrakTextStatusChange").getText(),
                TipeKontrakDest: this.byId("KontrakStatusChange").getValue(),
                TipeKontrakDescDest: this.byId("kontrakTextStatusChange").getText(),
                BeginDate: getFormattedDate("actDateStartStatusChange"),
                EndDate: getFormattedDate("actDateEndStatusChange"),
                StartDate: sBeginDate,
                ZbegdaEfktf: getFormattedDate("effectiveDateStartStatusChange"),
                ZenddaEfktf: getFormattedDate("effectiveDateEndStatusChange"),
                ValidDate: getFormattedDate("validDateStartStatusChange"),
                HasilPerformance: this.getView().getModel("performance").getProperty("/selectedPerformance/Value") || "",
                // hasil performance text blm ada id=hasilPerformTextStatusChange
                TotalNilai: this.byId("totalNilaiStatusChange").getValue(),
                // kategori evaluasi belum ada id=kategoriEvaluasiStatusChange
                KategoriEvaluasi: this.getView().getModel("evaluasi").getProperty("/selectedEvaluasi/Value") || "",
                Adjstmn: this.getView().getModel("dropdown").getProperty("/selectedSalaryAdj") || "",
                Zsalary: this.byId("salaryAdjValueStatusChange").getValue() ? this.byId("salaryAdjValueStatusChange").getValue().replace(/\D/g, '') : "0",
                Zdasar2: this.byId("basicConStatusChange").getValue(),
                // HbsAsl: this.byId("homebaseAsalStatusChange").getValue(),
                HbsDest: this.byId("homebaseTujuanStatusChange").getValue(),
                HbsDescDest: this.byId("homebaseTujuanTextStatusChange").getText(),
                // homebase tujuan belum ada id=homebaseTujuanStatusChange
                PlansReqDesc: oPlansReqDesc,
                NamaKantorReq: oNamaKantorReq,
                DivisiDescReq: oDivisiDescReq,
                // asal
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
                HbsDescAsl: this.byId("homebaseAsalTextStatusChange").getText()
            };
        
            console.log("Status Change Payload:", oPayload);
        
            // Show busy dialog
            if (!this._oBusyDialog) {
                this._oBusyDialog = new sap.m.BusyDialog();
            }
            this._oBusyDialog.setTitle("Please wait...");
            this._oBusyDialog.setText("Submitting request...");
            this._oBusyDialog.open();
        
            const oModel = this.getOwnerComponent().getModel("StatusChange");
            oModel.create("/RequestSet", oPayload, {
                success: (oData) => {
                    this._oBusyDialog.close();
                    MessageBox.success("Pengajuan Anda telah berhasil.", {
                        onClose: () => {
                            // Navigate to history view after success
                            this.getRouter().navTo("history");
                        }
                    });
                    if (oData && oData.RequestId) {
                        this.onSubmitFiles(oData.RequestId);
                    }
                },
                error: (oError) => {
                    this._oBusyDialog.close();
                    if (oError) {
                        try {
                            const oErrorMessage = JSON.parse(oError.responseText);
                            MessageBox.error(oErrorMessage.error.message.value);
                        } catch (e) {
                            MessageBox.error("Error submitting status change request: " + oError.message);
                        }
                    } else {
                        MessageBox.error("Unknown error occurred while submitting status change request.");
                    }
                }
            });
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

        // _loadPerformanceData: function() {
        //     return new Promise((resolve, reject) => {
        //         const oModel = this.getOwnerComponent().getModel("StatusChange");
        //         oModel.read("/ValueHelpPerformanceSet", {
        //             success: (oData) => {
        //                 console.log("Performance Data Loaded:", oData.results);
        
        //                 // Map the results to extract only the Value property
        //                 const aValues = oData.results.map(item => ({ Value: item.Value }));
        //                 const oPerformanceModel = new JSONModel({ items: aValues });
        
        //                 this.getView().setModel(oPerformanceModel, "performance");
        //                 console.log("Performance Model (Values Only):", this.getView().getModel("performance").getData());
        //                 resolve();
        //             },
        //             error: (oError) => {
        //                 MessageBox.error("Failed to load performance data.");
        //                 reject(oError);
        //             }
        //         });
        //     });
        // },

        _loadPerformanceData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("StatusChange");
                oModel.read("/ValueHelpPerformanceSet", {
                    success: (oData) => {
                        // Keep Key and Value, and sort by Key (as number)
                        const aSorted = oData.results
                            .map(item => ({ Key: item.Key, Value: item.Value }))
                            .sort((a, b) => Number(a.Key) - Number(b.Key));
                        const oPerformanceModel = new JSONModel({ items: aSorted });
                        this.getView().setModel(oPerformanceModel, "performance");
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load performance data.");
                        reject(oError);
                    }
                });
            });
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

        // handlePerformanceChange: function(oEvent) {
        //     const sSelectedKey = oEvent.getParameter("selectedItem").getKey();
        //     const sSelectedText = oEvent.getParameter("selectedItem").getText();
        
        //     const oPerformanceModel = this.getView().getModel("performance");
        //     oPerformanceModel.setProperty("/selectedPerformance", sSelectedText );
        
        //     console.log("Selected Performance:", oPerformanceModel.getProperty("/selectedPerformance"));
        // },

        // handleValueHelpPerformance: function() {
        //     if (!this._oValueHelpPerformanceDialog) {
        //         Fragment.load({
        //             name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpPerformance",
        //             controller: this
        //         }).then(function(oDialog) {
        //             this._oValueHelpPerformanceDialog = oDialog;
        //             this._oValueHelpPerformanceDialog.setModel(this.getView().getModel("performance"), "performance");
        //             this.getView().addDependent(this._oValueHelpPerformanceDialog);

        //             this._loadPerformanceData().then(() => {
        //                 this._oValueHelpPerformanceDialog.open();
        //             });
        //         }.bind(this));
        //     } else {
        //         this._oValueHelpPerformanceDialog.open();
        //     }
        // },

        // handleSearchPerformance: function (oEvent) {
        //     var sValue = oEvent.getParameter("value");
        //     var oKeyFilter = new Filter("Key", FilterOperator.Contains, sValue);
        //     var oValueFilter = new Filter("Value", FilterOperator.Contains, sValue);

        //     var oCombinedFilter = new Filter({
        //         filters: [oKeyFilter, oValueFilter],
        //         and: false
        //     });

        //     var oBinding = oEvent.getSource().getBinding("items");
        //     oBinding.filter([oCombinedFilter]);
        // },

        // handleClosePerformance: function(oEvent) {
        //     let aContexts = oEvent.getParameter("selectedContexts");
        //     if (aContexts && aContexts.length) {
        //         let oSelectedItem = aContexts[0].getObject();
        //         let oPerformanceModel = this.getView().getModel("performance");
                
        //         oPerformanceModel.setProperty("/selectedPerformance", oSelectedItem);
        //         this.byId("hasilperformStatusChange").setValue(oSelectedItem.Key);
        //     }
        //     oEvent.getSource().getBinding("items").filter([]);
        // },

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

        // handleEvaluasiChange: function(oEvent) {
        //     const sSelectedKey = oEvent.getParameter("selectedItem").getKey();
        //     const sSelectedText = oEvent.getParameter("selectedItem").getText();
        
        //     const oEvaluasiModel = this.getView().getModel("evaluasi");
        //     oEvaluasiModel.setProperty("/selectedEvaluasi", sSelectedText);
        
        //     console.log("Selected Evaluasi:", sSelectedKey, sSelectedText);
        // },

        // handleValueHelpEvaluasi: function() {
        //     if (!this._oValueHelpEvaluasiDialog) {
        //         Fragment.load({
        //             name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpEvaluasi",
        //             controller: this
        //         }).then(function(oDialog) {
        //             this._oValueHelpEvaluasiDialog = oDialog;
        //             this._oValueHelpEvaluasiDialog.setModel(this.getView().getModel("evaluasi"), "evaluasi");
        //             this.getView().addDependent(this._oValueHelpEvaluasiDialog);

        //             this._loadEvaluasiData().then(() => {
        //                 this._oValueHelpEvaluasiDialog.open();
        //             });
        //         }.bind(this));
        //     } else {
        //         this._oValueHelpEvaluasiDialog.open();
        //     }
        // },

        // handleSearchEvaluasi: function (oEvent) {
        //     var sValue = oEvent.getParameter("value");
        //     var oKeyFilter = new Filter("Key", FilterOperator.Contains, sValue);
        //     var oValueFilter = new Filter("Value", FilterOperator.Contains, sValue);

        //     var oCombinedFilter = new Filter({
        //         filters: [oKeyFilter, oValueFilter],
        //         and: false
        //     });

        //     var oBinding = oEvent.getSource().getBinding("items");
        //     oBinding.filter([oCombinedFilter]);
        // },

        // handleCloseEvaluasi: function(oEvent) {
        //     let aContexts = oEvent.getParameter("selectedContexts");
        //     if (aContexts && aContexts.length) {
        //         let oSelectedItem = aContexts[0].getObject();
        //         let oEvaluasiModel = this.getView().getModel("evaluasi");
                
        //         oEvaluasiModel.setProperty("/selectedEvaluasi", oSelectedItem);
        //         this.byId("kategoriEvaluasiStatusChange").setValue(oSelectedItem.Key);
        //     }
        // },

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

        // handleCloseHomebase: function(oEvent) {
        //     let aContexts = oEvent.getParameter("selectedContexts");
        //     if (aContexts && aContexts.length) {
        //         let oSelectedItem = aContexts[0].getObject();
        //         let oHomebaseModel = this.getView().getModel("homebase");
        //         // Set both Key and Value!
        //         oHomebaseModel.setProperty("/selectedHomebase", {
        //             Key: oSelectedItem.Key,
        //             Value: oSelectedItem.Value
        //         });
        //         this.byId("homebaseTujuanStatusChange").setValue(oSelectedItem.Key);
        //     }
        //     oEvent.getSource().getBinding("items").filter([]);
        // },

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

        // handleCloseHomebase: function(oEvent) {
        //     let aContexts = oEvent.getParameter("selectedContexts");
        //     if (aContexts && aContexts.length) {
        //         let oSelectedItem = aContexts[0].getObject();
        //         let oHomebaseModel = this.getView().getModel("homebase");
                
        //         oHomebaseModel.setProperty("/selectedHomebase", oSelectedItem);
        //         this.byId("homebaseTujuanStatusChange").setValue(oSelectedItem.Key);
        //     }
        //     oEvent.getSource().getBinding("items").filter([]);
        // },

        _loadReasonData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel("StatusChange");
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
        
            var oKeyFilter = new Filter("Key", FilterOperator.Contains, sValue);
            var oValueFilter = new Filter("Value", FilterOperator.Contains, sValue);
        
            var oCombinedFilter = new Filter({
                filters: [oKeyFilter, oValueFilter],
                and: false
            });
        
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oCombinedFilter]);
        },

        onReasonChange: function(oEvent) {
            // Get the selected reason key (from value help or input)
            let sReasonKey = "";
            if (oEvent && oEvent.getSource) {
                sReasonKey = oEvent.getSource().getValue();
            } else if (typeof oEvent === "string") {
                sReasonKey = oEvent;
            }

            var oSalaryAdjSelect = this.byId("salaryAdjStatusChange");
            if (oSalaryAdjSelect) {
                oSalaryAdjSelect.setSelectedKey("");
            }

            var oDropdownModel = this.getView().getModel("dropdown");
            oDropdownModel.setProperty("/selectedSalaryAdj", "");

            // Only enable salary adjustment if reason is "01"
            oDropdownModel.setProperty("/isSalaryAdjEnabled", sReasonKey === "01");

            // Disable upload document if reason is "03"
            var oUploadSet = this.byId("idUploadStatChange");
            if (oUploadSet) {
                oUploadSet.setUploadEnabled(sReasonKey !== "03");
            }

            // Hide upload panel, form, and uploadset if reason is "03"
            var oUploadPanel = this.byId("UploadPanel");
            var oAttDataForm = this.byId("attDataStatChangeForm");
            var oUploadSet = this.byId("idUploadStatChange");

            var bShowUpload = sReasonKey !== "03";
            if (oUploadPanel) {
                oUploadPanel.setVisible(bShowUpload);
            }
            if (oAttDataForm) {
                oAttDataForm.setVisible(bShowUpload);
            }
            if (oUploadSet) {
                oUploadSet.setVisible(bShowUpload);
            }

            // Homebase Tujuan editable only for reason "03"
            const oHomebaseInput = this.byId("homebaseTujuanStatusChange");
            if (oHomebaseInput) {
                oHomebaseInput.setEditable(sReasonKey === "03");
            }

            var oHomebaseModel = this.getView().getModel("homebase");
            var oHomebaseTujuanLabel = this.byId("homebaseTujuanLabel");
            var oHomebaseTujuan = this.byId("homebaseTujuanStatusChange");
            var oHomebaseTujuanText = this.byId("homebaseTujuanTextStatusChange");
            var oHomebaseAsal = this.byId("homebaseAsalStatusChange1");
            var oHomebaseAsalText = this.byId("homebaseAsalTextStatusChange");

            if (sReasonKey === "01" || sReasonKey === "02") {
                if (oHomebaseTujuan) {
                    oHomebaseTujuan.setVisible(false);
                    oHomebaseTujuan.setValue("");
                }
                if (oHomebaseTujuanLabel) {
                    oHomebaseTujuanLabel.setVisible(false);
                }
                if (oHomebaseAsal) {
                    oHomebaseAsal.setVisible(false);
                    oHomebaseAsal.setValue("");
                }
                if (oHomebaseAsalText) {
                    oHomebaseAsalText.setVisible(false);
                    oHomebaseAsalText.setText("");
                }
            } else {
                if (oHomebaseTujuan) {
                    oHomebaseTujuan.setVisible(true);
                }
                if (oHomebaseTujuanLabel) {
                    oHomebaseTujuanLabel.setVisible(true);
                }
                if (oHomebaseAsal) {
                    oHomebaseAsal.setVisible(true);
                }
                if (oHomebaseAsalText) {
                    oHomebaseAsalText.setVisible(true);
                }
            }

            if (sReasonKey === "03") {
            // Show and keep selected homebase fields as is
            if (oHomebaseTujuan) {
                oHomebaseTujuan.setVisible(true);
            }
            if (oHomebaseTujuanText) {
                oHomebaseTujuanText.setVisible(true);
            }
            if (oHomebaseAsal) {
            oHomebaseAsal.setVisible(true);
            }
            if (oHomebaseAsalText) {
                oHomebaseAsalText.setVisible(true);
            }
        } else {
            // Clear and show homebase fields for other reasons
            if (oHomebaseModel) {
                oHomebaseModel.setProperty("/selectedHomebase", { Key: "", Value: "" });
            }
            if (oHomebaseTujuan) {
                oHomebaseTujuan.setValue("");
                oHomebaseTujuan.setVisible(false); // or set to false if you want to hide
            }
            if (oHomebaseTujuanText) {
                oHomebaseTujuanText.setText("");
                oHomebaseTujuanText.setVisible(false); // or set to false if you want to hide
            }
            if (oHomebaseAsal) {
            oHomebaseAsal.setValue("");
            oHomebaseAsal.setVisible(false);
            }
            if (oHomebaseAsalText) {
                oHomebaseAsalText.setText("");
                oHomebaseAsalText.setVisible(false);
            }
        }

            const oValidDateStart = this.byId("validDateStartStatusChange");
            if (oValidDateStart) {
                oValidDateStart.setEditable(sReasonKey === "01");
            }

            var oTipeKontrakModel = this.getView().getModel("tipekontrak");
            var oKontrakStatusChange = this.byId("KontrakStatusChange");
            var oKontrakText = this.byId("kontrakTextStatusChange");

            // --- Auto select Y6 and fill 31.12.9999 if reason is 02 ---
            if (sReasonKey === "02") {
                if (oTipeKontrakModel) {
                    oTipeKontrakModel.setProperty("/selectedTipeKontrak", { Key: "Y6", Value: "Permanent" });
                }
                if (oKontrakStatusChange) {
                    oKontrakStatusChange.setValue("Y6");
                    oKontrakStatusChange.setEditable(false);
                }
                if (oKontrakText) {
                    oKontrakText.setText("Permanent");
                }
                // Set validDateStatusChange to 31.12.9999
                // var oValidDateStart = this.byId("validDateStartStatusChange");
                if (oValidDateStart) {
                    // Create a Date object for Dec 31, 9999
                    var oDate = new Date(9999, 11, 31); // Month is 0-based, so 11 = December
                    oValidDateStart.setDateValue(oDate);
                    oValidDateStart.setValue(oValidDateStart.getDateValue().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }));
                }
            } else {
                // Clear kontrak fields and make editable again
                if (oTipeKontrakModel) {
                    oTipeKontrakModel.setProperty("/selectedTipeKontrak", { Key: "", Value: "" });
                }
                if (oKontrakStatusChange) {
                    oKontrakStatusChange.setValue("");
                    oKontrakStatusChange.setEditable(true);
                }
                if (oKontrakText) {
                    oKontrakText.setText("");
                }
                if (oValidDateStart) {
                    oValidDateStart.setDateValue(null);
                    oValidDateStart.setValue("");
                }
            }

            // --- Hide fields if reason is 03 ---
            if (sReasonKey === "03") {
                if (oKontrakStatusChange) {
                    oKontrakStatusChange.setVisible(false);
                    oKontrakStatusChange.setValue("");
                }
                if (oKontrakText) {
                    oKontrakText.setVisible(false);
                    oKontrakText.setText("");
                }
                // Hide and clear valid date label, datepicker, and desc text
                var oValidDateLabel = this.byId("validDateLabel");
                // var oValidDateStart = this.byId("validDateStartStatusChange");
                var oValidDateDesc = this.byId("validDateDesc");
                if (oValidDateLabel) {
                    oValidDateLabel.setVisible(false);
                }
                if (oValidDateStart) {
                    oValidDateStart.setVisible(false);
                    oValidDateStart.setDateValue(null);
                    oValidDateStart.setValue("");
                }
                if (oValidDateDesc) {
                    oValidDateDesc.setVisible(false);
                }
                return; // Skip further logic for other reasons
            } else {
                if (oKontrakStatusChange) {
                    oKontrakStatusChange.setVisible(true);
                }
                if (oKontrakText) {
                    oKontrakText.setVisible(true);
                }
                // Show valid date label, datepicker, and desc text
                var oValidDateLabel = this.byId("validDateLabel");
                // var oValidDateStart = this.byId("validDateStartStatusChange");
                var oValidDateDesc = this.byId("validDateDesc");
                if (oValidDateLabel) {
                    oValidDateLabel.setVisible(true);
                }
                if (oValidDateStart) {
                    oValidDateStart.setVisible(true);
                }
                if (oValidDateDesc) {
                    oValidDateDesc.setVisible(true);
                }
            }
        },

        // onReasonChange: function(sReasonKey) {
        //     const oDropdownModel = this.getView().getModel("dropdown");
        //     // Penyesuaian Gaji & Usulan Gaji editable only for reason "01" (contract extend)
        //     const isSalaryEditable = sReasonKey === "01";
        //     oDropdownModel.setProperty("/isSalaryAdjEnabled", isSalaryEditable);

        //     // Homebase Tujuan editable only for reason "03" (change homebase)
        //     const isHomebaseEditable = sReasonKey === "03";
        //     const oHomebaseInput = this.byId("homebaseTujuanStatusChange");
        //     if (oHomebaseInput) {
        //         oHomebaseInput.setEditable(isHomebaseEditable);
        //     }
        // },

        handleCloseReason: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oReasonModel = this.getView().getModel("reason");
                
                oReasonModel.setProperty("/selectedReason", oSelectedItem);
                this.byId("reasonStatusChange").setValue(oSelectedItem.Key);

                this.onReasonChange(oSelectedItem.Key);
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
            const oModel = this.getOwnerComponent().getModel("StatusChange");

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

            // const sUserStat = oCurrentUserModel.getProperty("/Stat");
            const sPicName = oCurrentUserModel.getProperty("/EmployeeName/FormattedName");
            const sPicId = oCurrentUserModel.getProperty("/EmployeeNumber");

            // Determine TypeDoc and PicPosition based on STAT
            let sTypeDoc = "PKWT Terakhir";
            let sPicPosition = "Requestor"; // Default position if STAT is not recognized

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
                            MessageBox.success("Dokumen berhasil diunggah.", {
                                onClose: () => {
                                    console.log("Unggah dokumen selesai diproses.");
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
                                "ZHR_STAT_CHANGE_MAN_SRV_01",
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