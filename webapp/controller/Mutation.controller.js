sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/library",
], function (BaseController, formatter, Fragment, JSONModel, MessageBox, MessageToast, Filter, FilterOperator, CoreLib) {
    "use strict";
    var oBundle, ValueState = CoreLib.ValueState;

    return BaseController.extend("bsim.hcmapp.man.movement.controller.Mutation", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this.setModel(new JSONModel(), "create");
            this._currentUser();
            this.getRouter().getRoute("mutation").attachPatternMatched(this._onMutationRouteMatched, this);
            
            // Set default POV to EmployeeNumber 81000038
            let oEmployeeModel = new JSONModel({
            });
            this.getView().setModel(oEmployeeModel, "employee");

            // let oRequestorModel = new JSONModel({
            //     EmployeeNumber: "81000038"
            // });
            // this.getView().setModel(oRequestorModel, "requestor");

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

            // oGrievancesModel.read("/RequestSet", {
            //     urlParameters: {
            //         "$expand": "toAttachmentView", // Expand toAttachmentView
            //         "$orderby": "CreatedOn desc, CreatedAt desc" // Sort by CreatedOn and CreatedAt descending
            //     },
            //     success: (oData) => {
            //         console.log("Grievances data with attachments loaded successfully:", oData);
            
            //         // Step 1: Get the most recent request
            //         const aRequests = oData.results || [];
            //         if (aRequests.length === 0) {
            //             console.warn("No requests found.");
            //             sap.m.MessageBox.error("No requests found.");
            //             return;
            //         }
            
            //         const oLatestRequest = aRequests[0]; // The first request is the newest due to sorting
            //         console.log("Most recent request:", oLatestRequest);
            
            //         // Step 2: Process attachments from the newest request
            //         const aAttachments = oLatestRequest.toAttachmentView?.results || [];
            //         const aFilteredAttachments = aAttachments.filter(attachment => attachment.TypeDoc === "ST/SP Baru");
            
            //         if (aFilteredAttachments.length > 0) {
            //             console.log("Filtered Attachments with TypeDoc 'ST/SP Baru':", aFilteredAttachments);
            
            //             // Step 3: Bind filtered attachments to a model
            //             const oAttachmentModel = new sap.ui.model.json.JSONModel(aFilteredAttachments);
            //             this.getView().setModel(oAttachmentModel, "FilteredAttachments");
            //         } else {
            //             console.warn("No attachments with TypeDoc 'ST/SP Baru' found.");
            //             sap.m.MessageBox.error("No attachments with TypeDoc 'ST/SP Baru' found.");
            //         }
            //     },
            //     error: (oError) => {
            //         console.error("Error loading grievances data with attachments:", oError);
            //         sap.m.MessageBox.error("Failed to load grievances data.");
            //     }
            // });

            // Optionally, preload data into the model
            // oGrievancesModel.read("/RequestSet", {
            //     urlParameters: {
            //         "$expand": "toAttachmentView", // Expand toAttachmentView
            //         "$orderby": "CreatedOn desc, CreatedAt desc" // Sort by CreatedOn and CreatedAt descending
            //     },
            //     success: (oData) => {
            //         console.log("Grievances data with attachments loaded successfully:", oData);
            
            //         // Step 1: Get the most recent request
            //         const aRequests = oData.results || [];
            //         if (aRequests.length === 0) {
            //             console.warn("No requests found.");
            //             sap.m.MessageBox.error("No requests found.");
            //             return;
            //         }
            
            //         const oLatestRequest = aRequests[0]; // The first request is the newest due to sorting
            //         console.log("Most recent request:", oLatestRequest);
            
            //         // Step 2: Process attachments from the newest request
            //         const aAttachments = oLatestRequest.toAttachmentView?.results || [];
            //         const aFilteredAttachments = aAttachments.filter(attachment => attachment.TypeDoc === "ST/SP Baru");
            
            //         if (aFilteredAttachments.length > 0) {
            //             console.log("Filtered Attachments with TypeDoc 'ST/SP Baru':", aFilteredAttachments);
            
            //             // Step 3: Bind filtered attachments to a model
            //             const oAttachmentModel = new sap.ui.model.json.JSONModel(aFilteredAttachments);
            //             this.getView().setModel(oAttachmentModel, "FilteredAttachments");
            //         } else {
            //             console.warn("No attachments with TypeDoc 'ST/SP Baru' found.");
            //             sap.m.MessageBox.error("No attachments with TypeDoc 'ST/SP Baru' found.");
            //         }
            //     },
            //     error: (oError) => {
            //         console.error("Error loading grievances data with attachments:", oError);
            //         sap.m.MessageBox.error("Failed to load grievances data.");
            //     }
            // });

            const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: [] });
            this.getView().setModel(oFileAttachmentModel, "fileAttachment");

            const oViewModel = new JSONModel({
                isSubmitDisabled: false,
                isVerifyMutation: false
            });
            this.getView().setModel(oViewModel, "viewModel");

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

            let oAssessmentMutationModel = new JSONModel({
                selectedIndex: 0
            });
            this._oView.setModel(oAssessmentMutationModel, "assessmentMutation");

            let oDisposisiMutationModel = new JSONModel({
                selectedIndex: 0
            });
            this._oView.setModel(oDisposisiMutationModel, "disposisiMutation");

            var oDate = new Date();
            oDate.setDate(1);

            var sFormattedEndDate = "9999-12-31";
            var sFormattedDate = oDate.toISOString().split("T")[0];

            this.getView().byId("effectiveDateEndMutation").setValue(sFormattedEndDate);
            this.getView().byId("effectiveDateStartMutation").setValue(sFormattedDate);

            // --- Auto-set tanggalBerakhirMutation based on effectiveDateStartMutation ---
            var oEndDate = new Date(oDate);
            oEndDate.setFullYear(oEndDate.getFullYear() + 4);
            oEndDate.setDate(oEndDate.getDate() - 1);
            this.getView().byId("tanggalBerakhirMutation").setDateValue(oEndDate);

            // let oGroupModel = this.getOwnerComponent().getModel("group");
            // this.getView().setModel(oGroupModel, "group");

            // let oAreaModel = this.getOwnerComponent().getModel("area");
            // // this.getView().setModel(oAreaModel, "area");

            // let oSubGroupModel = this.getOwnerComponent().getModel("subGroup");
            // this.getView().setModel(oSubGroupModel, "subGroup");

            // let oSubAreaModel = this.getOwnerComponent().getModel("subArea");
            // this.getView().setModel(oSubAreaModel, "subArea");
        },

        _onMutationRouteMatched: function (oEvent) {
            const oArguments = oEvent.getParameter("arguments") || {};
            const EmployeeNumber = oArguments.EmployeeNumber;
            const oAppModel = this.getModel("appModel");
        
            if (!EmployeeNumber) {
                MessageBox.error("Employee number is missing. Cannot proceed.");
                this.onNavBack();
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel();
        
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
                    new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.NE, "A7")
                ],
                success: (oData) => {
                    const aRequests = oData.results || [];
                    const hasPendingRequest = aRequests.some(
                        r => r.EmployeeNumber === EmployeeNumber && r.Status !== "A7"
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

        // fix
        // _onMutationRouteMatched: function (oEvent) {
        //     const EmployeeNumber = oEvent.getParameter("arguments").EmployeeNumber;
        //     if (EmployeeNumber) {
        //         this._getEmployeeData(EmployeeNumber);
        //     }

        //      // Clear any existing files in the upload set
        //      const oUploadSet = this.byId("idUploadSet");
        //      if (oUploadSet) {
        //          oUploadSet.removeAllItems();
        //      }
             
        //      // Reset the file attachment model
        //      const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //      if (oFileAttachmentModel) {
        //          oFileAttachmentModel.setProperty("/results", []);
        //      }
             
        //      // Get request ID from route parameters
        //      var oArguments = oEvent.getParameter("arguments");
             
        //      if (oArguments && oArguments.requestId) {
        //          this._sRequestId = oArguments.requestId;
        //          this._getRequestData();
        //      } else {
        //          // Try to get from application model if we're coming from another view
        //          var oAppModel = this.getModel("appModel");
        //          if (oAppModel && oAppModel.getProperty("/selectedRequest")) {
        //              this._sRequestId = oAppModel.getProperty("/selectedRequest/RequestId");
        //              this._getRequestData();
        //          } else {
        //              M.information("No request selected");
        //              this.onNavBack();
        //          }
        //     }
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

        // _getEmployeeData: function (EmployeeNumber) {
        //     // Define paths for EmployeeSet and EmployeeDetailSet
        //     const sEmployeePath = `/EmployeeSet('${EmployeeNumber}')`;
        //     const sEmployeeDetailPath = `/EmployeeDetailSet('${EmployeeNumber}')`;
        
        //     let oEmployeeModel = this.getView().getModel("employee");
        //     let oEmployeeDetailModel = this.getView().getModel("employeeDetail");
        
        //     this._oBusy.open();
        
        //     // Fetch EmployeeSet data
        //     this.readEntity(sEmployeePath)
        //         .then((employeeResult) => {
        //             if (!employeeResult) {
        //                 MessageBox.error(this.getResourceBundle().getText("msgNotAuthorized"), {
        //                     actions: ["Exit"],
        //                     onClose: (sAction) => {
        //                         this._navBack();
        //                     },
        //                 });
        //                 return Promise.reject("No EmployeeSet data found.");
        //             }
        
        //             // Set EmployeeSet data to the model
        //             oEmployeeModel.setData(employeeResult);
        //             console.log("EmployeeSet Data loaded:", employeeResult);
        
        //             // Fetch EmployeeDetailSet data
        //             return this.readEntity(sEmployeeDetailPath);
        //         })
        //         .then((employeeDetailResult) => {
        //             if (employeeDetailResult) {
        //                 // Set EmployeeDetailSet data to the model
        //                 if (!oEmployeeDetailModel) {
        //                     oEmployeeDetailModel = new sap.ui.model.json.JSONModel();
        //                     this.getView().setModel(oEmployeeDetailModel, "employeeDetail");
        //                 }
        //                 oEmployeeDetailModel.setData(employeeDetailResult);
        //                 console.log("EmployeeDetailSet Data loaded:", employeeDetailResult);
        //             } else {
        //                 console.warn("EmployeeDetailSet data is missing.");
        //             }
        //         })
        //         .catch((error) => {
        //             console.error("Error loading employee data:", error);
        //             MessageBox.error("Error loading employee details");
        //         })
        //         .finally(() => {
        //             this._oBusy.close();
        //         });
        // },

        // _getEmployeeData: function (EmployeeNumber) {
        //     const sPath = `/EmployeeDetailSet('${EmployeeNumber}')`; // Path for specific employee
        //     // console.log("Loading employee data for:", EmployeeNumber);
            
        //     let oEmployeeModel = this.getView().getModel("employee");
        //     this._oBusy.open();
            
        //     oEmployeeModel.loadData(`http://localhost:8080/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV${sPath}?$format=json`, null, true, "GET", false, false, {
        //         "Content-Type": "application/json"
        //     });
            
        //     this.readEntity(sPath).then((result) => {
        //         if (!result) {
        //             MessageBox.error(this.getResourceBundle().getText("msgNotAuthorized"), {
        //                 actions: ["Exit"],
        //                 onClose: (sAction) => {
        //                     this._navBack();
        //                 },
        //             });
        //         } else {
        //             // Set the data to the model
        //             oEmployeeModel.setData(result);
        //             console.log("Employee Data loaded:", result);
        //         }   
        //         this._oBusy.close();
        //     }).catch((error) => {
        //         console.error("Error loading employee data:", error);
        //         this._oBusy.close();
        //         MessageBox.error("Error loading employee details");
        //     });
        // },

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
        //             "$orderby": "CreatedOn desc, CreatedAt desc" // Sort by CreatedOn and CreatedAt descending
        //         },
        //         success: (oData) => {
        //             console.warn("Requests fetched successfully:", oData);
        
        //             if (!oData.results || oData.results.length === 0) {
        //                 console.warn("No requests found for EmployeeNumber:", sEmployeeNumber);
        //                 sap.m.MessageBox.error("No requests found for the given employee.");
        //                 return;
        //             }
        
        //             // Step 2: Get the most recent request based on CreatedOn and CreatedAt
        //             const oLatestRequest = oData.results.reduce((latest, current) => {
        //                 const latestDate = new Date(latest.CreatedOn);
        //                 const currentDate = new Date(current.CreatedOn);
        
        //                 if (currentDate > latestDate) {
        //                     return current;
        //                 } else if (currentDate.getTime() === latestDate.getTime()) {
        //                     // Compare CreatedAt if CreatedOn is the same
        //                     const latestTime = latest.CreatedAt.ms || 0;
        //                     const currentTime = current.CreatedAt.ms || 0;
        //                     return currentTime > latestTime ? current : latest;
        //                 }
        //                 return latest;
        //             });
        
        //             const sRequestGUID = oLatestRequest.RequestId;
        //             console.warn("Most recent RequestId:", sRequestGUID);
        
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
        
        //                     // Step 4: Filter documents with TypeDoc "ST/TP Baru"
        //                     const aSTTPBaruDocs = oAttachmentData.results.filter(doc => doc.TypeDoc === "ST/SP Baru");
        
        //                     if (aSTTPBaruDocs.length === 0) {
        //                         console.warn("No documents with TypeDoc 'ST/SP Baru' found for RequestId:", sRequestGUID);
        //                         sap.m.MessageBox.error("No documents with TypeDoc 'ST/TP Baru' found.");
        //                         return;
        //                     }
        
        //                     // Step 5: Find the document with the highest SequenceNo
        //                     const oSelectedAttachment = aSTTPBaruDocs.reduce((highest, current) => {
        //                         return current.SequenceNo > highest.SequenceNo ? current : highest;
        //                     });
        
        //                     console.warn("Selected attachment with highest SequenceNo:", oSelectedAttachment);
        
        //                     if (!oSelectedAttachment || !oSelectedAttachment.Url) {
        //                         console.warn("No valid document URL found in the attachments for RequestId:", sRequestGUID);
        //                         sap.m.MessageBox.error("No valid document URL found in the attachments.");
        //                         return;
        //                     }
        
        //                     // Step 6: Display the document
        //                     const sDocumentUrl = oSelectedAttachment.Url;
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
        //             "$orderby": "CreatedOn desc, CreatedAt desc" // Sort by CreatedOn and CreatedAt descending
        //         },
        //         success: (oData) => {
        //             console.warn("Requests fetched successfully:", oData);
        
        //             if (!oData.results || oData.results.length === 0) {
        //                 console.warn("No requests found for EmployeeNumber:", sEmployeeNumber);
        //                 sap.m.MessageBox.error("No requests found for the given employee.");
        //                 return;
        //             }
        
        //             // Step 2: Get the most recent request based on CreatedOn and CreatedAt
        //             const oLatestRequest = oData.results.reduce((latest, current) => {
        //                 const latestDate = new Date(latest.CreatedOn);
        //                 const currentDate = new Date(current.CreatedOn);
        
        //                 if (currentDate > latestDate) {
        //                     return current;
        //                 } else if (currentDate.getTime() === latestDate.getTime()) {
        //                     // Compare CreatedAt if CreatedOn is the same
        //                     const latestTime = latest.CreatedAt.ms || 0;
        //                     const currentTime = current.CreatedAt.ms || 0;
        //                     return currentTime > latestTime ? current : latest;
        //                 }
        //                 return latest;
        //             });
        
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

        // onDisplayDocumentWarning: function () {
        //     const oModel = this.getOwnerComponent().getModel("Grievances"); // Access the Grievances model
        //     const sEmployeeNumber = this.getView().getModel("employeeDetail").getProperty("/EmployeeNumber");
        
        //     if (!sEmployeeNumber) {
        //         sap.m.MessageBox.error("Employee number is missing. Cannot fetch document.");
        //         return;
        //     }
        
        //     // Step 1: Fetch requests matching the employee number
        //     oModel.read("/RequestSet", {
        //         filters: [new sap.ui.model.Filter("EmployeeNumber", sap.ui.model.FilterOperator.EQ, sEmployeeNumber)],
        //         urlParameters: {
        //             "$orderby": "CreatedOn desc" // Sort by CreatedOn descending
        //         },
        //         success: (oData) => {
        //             if (!oData.results || oData.results.length === 0) {
        //                 sap.m.MessageBox.error("No requests found for the given employee.");
        //                 return;
        //             }
        
        //             // Step 2: Get the most recent request
        //             const oLatestRequest = oData.results[0];
        //             const sRequestGUID = oLatestRequest.RequestId;
        
        //             // Step 3: Expand to toAttachmentView
        //             const sExpandPath = `/RequestSet(guid'${sRequestGUID}')/toAttachmentView`;
        //             oModel.read(sExpandPath, {
        //                 success: (oAttachmentData) => {
        //                     if (!oAttachmentData.results || oAttachmentData.results.length === 0) {
        //                         sap.m.MessageBox.error("No attachments found for the latest request.");
        //                         return;
        //                     }
        
        //                     // Step 4: Find the document with the latest SequenceNo
        //                     const oLatestAttachment = oAttachmentData.results.reduce((latest, current) => {
        //                         return current.SequenceNo > latest.SequenceNo ? current : latest;
        //                     });
        
        //                     if (!oLatestAttachment || !oLatestAttachment.DocumentUrl) {
        //                         sap.m.MessageBox.error("No valid document found in the attachments.");
        //                         return;
        //                     }
        
        //                     // Step 5: Display the document
        //                     window.open(oLatestAttachment.DocumentUrl, "_blank");
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

        handleLiveChange: function (oEvent) {
            var oTextArea = oEvent.getSource(),
                iValueLength = oTextArea.getValue().length,
                iMaxLength = oTextArea.getMaxLength(),
                sState = iValueLength > iMaxLength ? ValueState.Warning : ValueState.None;

            oTextArea.setValueState(sState);
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

            // Disable the submit button
            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/isSubmitDisabled", true);
        
            // Confirm with user before sending
            MessageBox.confirm("Do you want to submit this request?", {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                initialFocus: MessageBox.Action.NO,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.YES) {
                        this._postRequest();
                    } else {
                        return false;
                    }
                }
            });
        },

        // onSendRequest: function () {
        //     // Get employee model
        //     let oEmployeeModel = this.getView().getModel("employee");
        //     console.log("Employee Model Data:", oEmployeeModel.getData());
        //     let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
        //     let oSelectedEmpSupervisor = oEmployeeModel.getProperty("/Supervisor");
        
        //     // Get the logged-in user's employee number
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
        
        //     // Check for existing requests for the employee
        //     const oModel = this.getOwnerComponent().getModel();
        //     oModel.read("/RequestSet", {
        //         filters: [
        //             new Filter("EmployeeNumber", FilterOperator.EQ, oSelectedEmp),
        //             new Filter("Status", FilterOperator.NE, "P") // Exclude "posted" requests
        //         ],
        //         success: (oData) => {
        //             console.log("Data returned from backend:", oData);
                
        //             // Ensure results exist and are properly filtered
        //             const aResults = oData.results || [];
        //             const aFilteredResults = aResults.filter(request => request.EmployeeNumber === oSelectedEmp && request.Status !== "P");
                
        //             if (aFilteredResults.length > 0) {
        //                 MessageBox.error("A movement request for this employee is already in progress. Please complete the approval process before creating a new request.");
        //                 return;
        //             }
                
        //             // Proceed with submission if no conflicting requests are found
        //             this._validateAndSubmitRequest();
        //         },
        //         error: (oError) => {
        //             console.error("Error checking existing requests:", oError);
        //             MessageBox.error("Failed to check existing requests. Please try again later.");
        //         }
        //     });
        // },
        
        // _validateAndSubmitRequest: function () {
        //     // Validate required entries
        //     var oView = this.getView();
        //     if (!this._validateEntries(oView, "grpValidation")) {
        //         return;
        //     }
        
        //     // Confirm with user before sending
        //     MessageBox.confirm("Do you want to submit this request?", {
        //         actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        //         emphasizedAction: MessageBox.Action.NO,
        //         initialFocus: MessageBox.Action.NO,
        //         onClose: (sAction) => {
        //             if (sAction === MessageBox.Action.YES) {
        //                 this._postRequest();
        //             }
        //         }
        //     });
        // },

        _postRequest: function () {
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
            const PlansDest      = oSelectedPosition.Key || this.byId("newPositionIdMutation").getValue();
            const PlansDesc_Dest = oSelectedPosition.Value || this.byId("newPositionTextMutation").getText();

            const PersgDest      = oSelectedGroup.Key || oSelectedPosition.Key6 || this.byId("newEmployeeGroupIdMutation").getValue();
            const PersgDestDesc  = oSelectedGroup.Value || oSelectedPosition.KeyDesc6 || this.byId("newEmployeeGroupTextMutation").getText();

            const PerskDest      = oSelectedSubGroup.Key2 || oSelectedPosition.Key7 || this.byId("newEmployeeSubgroupIdMutation").getValue();
            const PerskDestDesc  = oSelectedSubGroup.Value || oSelectedPosition.KeyDesc7 || this.byId("newEmployeeSubgroupTextMutation").getText();

            const WerksDest      = oSelectedArea.Key || oSelectedPosition.Key4 || this.byId("newPerAreaIdMutation").getValue();
            const WerksDestDesc  = oSelectedArea.Value || oSelectedPosition.KeyDesc4 || this.byId("newPerAreaTextMutation").getText();

            const BtrtlDest      = oSelectedSubArea.Key2 || oSelectedPosition.Key5 || this.byId("newPerSubAreaIdMutation").getValue();
            const BtrtlDestDesc  = oSelectedSubArea.Value || oSelectedPosition.KeyDesc5 || this.byId("newPerSubAreaTextMutation").getText();
        
            if (!sLoggedInEmployeeId) {
                MessageBox.error("Unable to retrieve logged-in user details.");
                return;
            }
        
            if (!oSelectedEmp) {
                MessageBox.error("Please select an employee first.");
                return;
            }

            if (!sBeginDate) {
                MessageBox.error("Unable to retrieve the employee's BeginDate.");
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
                Massg: this.byId("reasonMutation").getValue(),
                MassgDesc: this.byId("reasonTextMutation").getText(),
                BeginDate: getFormattedDate("actDateStartMutation"),
                EndDate: getFormattedDate("actDateEndMutation"),
                StartDate: sBeginDate,
                ZbegdaEfktf: getFormattedDate("effectiveDateStartMutation"),
                ZenddaEfktf: getFormattedDate("effectiveDateEndMutation"),
                // PlansDest: this.byId("newPositionIdMutation").getValue(),
                // PlansDesc_Dest: this.byId("newPositionTextMutation").getText(),
                // PersgDest: this.byId("newEmployeeGroupIdMutation").getValue(),
                // PersgDestDesc: this.byId("newEmployeeGroupTextMutation").getText(),
                // PerskDest: this.byId("newEmployeeSubgroupIdMutation").getValue(),
                // PerskDestDesc: this.byId("newEmployeeSubgroupTextMutation").getText(),
                // WerksDest: this.byId("newPerAreaIdMutation").getValue(),
                // WerksDestDesc: this.byId("newPerAreaTextMutation").getText(),
                // BtrtlDest: this.byId("newPerSubAreaIdMutation").getValue(),
                // BtrtlDestDesc: this.byId("newPerSubAreaTextMutation").getText(),
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
                Zsalary: this.byId("salaryAdjValueMutation").getValue() ? this.byId("salaryAdjValueMutation").getValue().replace(/\D/g, '') : "0",
                Zdasar1: sSelectedAs,
                Zexholder: this.byId("employeeChangeMutation").getValue(),
                ZexholderDesc: this.byId("employeeChangeTextMutation").getText(),
                Zdasar2: this.byId("basicConMutation").getValue(),
                PlansAsl: this.byId("currentPositionIdMutation").getValue(),
                PlansDescAsl: this.byId("currentPositionTextMutation").getText(),
                WerksAsl: this.byId("currentPerAreaIdMutation").getValue(), 
                WerksDescAsl: this.byId("currentPerAreaTextMutation").getText(),
                BtrtlAsl: this.byId("currentPerSubAreaIdMutation").getValue(),
                BtrtlDescAsl: this.byId("currentPerSubAreaTextMutation").getText(),
                OuAsl: this.byId("currentUnitOrgIdMutation").getValue(),
                OuDecAsl: this.byId("currentUnitOrgTextMutation").getText(),
                OuDest: this.byId("newUnitOrgIdMutation").getValue(),
                OuDescDest: this.byId("newUnitOrgTextMutation").getText(),
                DivisiAsl: this.byId("currentDivisionIdMutation").getValue(),
                DivisiDescAsl: this.byId("currentDivisionTextMutation").getText(), 
                DivisiDest: this.byId("newDivisionIdMutation").getValue(),
                DivisiDescDest: this.byId("newDivisionTextMutation").getText(),
                PlansReqDesc: oPlansReqDesc,
                NamaKantorReq: oNamaKantorReq,
                DivisiDescReq: oDivisiDescReq,
                CareerBandAsl: this.byId("careerAsalMutasi").getValue(),
                CareerBandDescAsl: this.byId("careerAsalTextMutasi").getText(),
                CareerBandDest: this.byId("careerTujuanMutasi").getValue(),
                CareerBandDescDest: this.byId("careerTujuanTextMutasi").getText(),
                TanggalJabatanDest: getFormattedDate("tanggalBerakhirMutation")
            };
        
            console.log("Mutation Payload:", oPayload);
        
            // Show busy dialog
            if (!this._oBusyDialog) {
                this._oBusyDialog = new sap.m.BusyDialog();
            }
            this._oBusyDialog.setTitle("Please wait...");
            this._oBusyDialog.setText("Submitting request...");
            this._oBusyDialog.open();
        
            // Submit mutation data
            const oModel = this.getOwnerComponent().getModel();
            oModel.create("/RequestSet", oPayload, {
                success: (oData) => {
                    this._oBusyDialog.close();
                    // this.onSubmitFiles(oData.RequestId);
        
                    MessageBox.success("Request has been submitted successfully.", {
                        onClose: () => {
                            // Navigate to history view after success
                            this.getRouter().navTo("history");
                        }
                    });
                },
                error: (oError) => {
                    this._oBusyDialog.close();
        
                    // Show error message
                    if (oError) {
                        try {
                            const oErrorMessage = JSON.parse(oError.responseText);
                            MessageBox.error(oErrorMessage.error.message.value);
                        } catch (e) {
                            MessageBox.error("Error submitting request: " + oError.message);
                        }
                    } else {
                        MessageBox.error("Unknown error occurred while submitting request.");
                    }
                }
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
        //         MessageBox.warning("No files to upload. Submission completed without file uploads.");
        //         return;
        //     }
        
        //     // Show busy indicator
        //     this._oBusyDialog.open();
        
        //     const aPromises = aFiles.map((oFile, index) => {
        //         const oPayload = {
        //             Reqid: sRequestId,
        //             Seqnr: index.toString(),
        //             FileName: oFile.FileName,
        //             FileType: oFile.FileType,
        //             FileSize: oFile.FileSize.toString(),
        //             Attachment: oFile.Attachment,
        //             CreatedOn: new Date().toISOString().split('.')[0], // Format as ISO without milliseconds
        //             TypeDoc: "BI Checking", // Ensure this matches backend expectations
        //             PicPosition: "Compensation & Benefit", // Ensure this matches backend expectations
        //             PicName: "Roy", // Ensure this matches backend expectations
        //             PicId: "81000061", // Ensure this matches backend expectations
        //         };
        
        //         console.log("Uploading file with payload:", oPayload); // Log the payload for debugging
        
        //         return new Promise((resolve, reject) => {
        //             oModel.create("/FileAttachmentSet", oPayload, {
        //                 success: resolve,
        //                 error: reject
        //             });
        //         });
        //     });
        
        //     Promise.all(aPromises)
        //         .then(() => {
        //             this._oBusyDialog.close();
        //             MessageBox.success("All files uploaded successfully.");
        //         })
        //         .catch((oError) => {
        //             this._oBusyDialog.close();
        
        //             // Parse and display backend error message
        //             let sErrorMessage = "Failed to upload one or more files.";
        //             if (oError && oError.responseText) {
        //                 try {
        //                     const oErrorResponse = JSON.parse(oError.responseText);
        //                     if (oErrorResponse.error && oErrorResponse.error.message) {
        //                         sErrorMessage = oErrorResponse.error.message.value || sErrorMessage;
        //                     }
        //                 } catch (e) {
        //                     console.error("Error parsing backend response:", e);
        //                 }
        //             }
        
        //             console.error("File upload error:", oError);
        //             MessageBox.error(sErrorMessage);
        //         });
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
        //         MessageBox.warning("No files to upload. Submission completed without file uploads.");
        //         return;
        //     }
        
        //     // Show busy indicator
        //     this._oBusyDialog.open();
        
        //     const aPromises = aFiles.map((oFile, index) => {
        //         const oPayload = {
        //             Reqid: sRequestId,
        //             Seqnr: index.toString(),
        //             FileName: oFile.FileName,
        //             FileType: oFile.FileType,
        //             FileSize: oFile.FileSize.toString(),
        //             Attachment: oFile.Attachment,
        //             CreatedOn: new Date().toISOString().split('.')[0], // Format as ISO without milliseconds
        //             TypeDoc: "BI Checking",
        //             PicPosition: "Compensation & Benefit",
        //             PicName: "Roy",
        //             PicId: "81000061",
        //         };
        
        //         return new Promise((resolve, reject) => {
        //             oModel.create("/FileAttachmentSet", oPayload, {
        //                 success: resolve,
        //                 error: reject
        //             });
        //         });
        //     });
        
        //     Promise.all(aPromises)
        //         .then(() => {
        //             this._oBusyDialog.close();
        //             MessageBox.success("All files uploaded successfully.");
        //         })
        //         .catch((oError) => {
        //             this._oBusyDialog.close();
        //             MessageBox.error("Failed to upload one or more files. Please try again.");
        //         });
        // },

        // _postRequest: function () {
        //     // Prepare mutation payload
        //     let oEmployeeModel = this.getView().getModel("employee");
        //     let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
        
        //     let oCurrentUserModel = this.getView().getModel("currentUser");
        //     let sLoggedInEmployeeId = oCurrentUserModel ? oCurrentUserModel.getProperty("/EmployeeNumber") : null;

        //     if (!sLoggedInEmployeeId) {
        //         MessageBox.error("Unable to retrieve logged-in user details.");
        //         return;
        //     }
        
        //     const getFormattedDate = (controlId) => {
        //         const control = this.byId(controlId);
        //         if (control && typeof control.getDateValue === "function") {
        //             const dateValue = control.getDateValue();
        //             return dateValue ? this.formatter.formatDateUtc(dateValue) : null;
        //         }
        //         return null;
        //     };

        //     const checkboxIds = ["hasilMutation1", "hasilMutation2", "hasilMutation3", "hasilMutation4", "hasilMutation5"];
        //     let Zbichecking = checkboxIds
        //         .map(id => this.byId(id))
        //         .filter(checkbox => checkbox && checkbox.getSelected())
        //         .map(checkbox => checkbox.getText())
        //         .join(",");

        //     // Retrieve the position description from the ValueHelpPositionSet model
        //     let oPositionModel = this.getView().getModel("position");
        //     let oSelectedPosition = oPositionModel.getProperty("/selectedPosition");
        //     let sPlansDestDesc = oSelectedPosition ? oSelectedPosition.Value : "";

        //     let oAreaModel = this.getView().getModel("area");
        //     let oSelectedArea = oAreaModel.getProperty("/selectedArea");
        //     let sWerksDestDesc = oSelectedArea ? oSelectedArea.Value : "";

        //     let oReasonModel = this.getView().getModel("reason");
        //     let oSelectedReason = oReasonModel.getProperty("/selectedReason");
        //     let sMassgDesc = oSelectedReason ? oSelectedReason.Value : "";
        
        //     // Retrieve the sub-area description from the ValueHelpSubArea model
        //     let oSubAreaModel = this.getView().getModel("subArea");
        //     let oSelectedSubArea = oSubAreaModel.getProperty("/selectedSubArea");
        //     let sBtrtlDestDesc = oSelectedSubArea ? oSelectedSubArea.Value : "";

        //     // Retrieve the group description from the ValueHelpGroup model
        //     let oGroupModel = this.getView().getModel("group");
        //     let oSelectedGroup = oGroupModel.getProperty("/selectedGroup");
        //     let sPersgDestDesc = oSelectedGroup ? oSelectedGroup.Value : "";

        //     // Retrieve the subgroup description from the ValueHelpSubGroup model
        //     let oSubGroupModel = this.getView().getModel("subGroup");
        //     let oSelectedSubGroup = oSubGroupModel.getProperty("/selectedSubGroup");
        //     let sPerskDestDesc = oSelectedSubGroup ? oSelectedSubGroup.Value : "";

        //     // Retrieve the employee change description from the ValueHelpNumberSet model
        //     let oEmployeeChangeModel = this.getView().getModel("employeechange");
        //     let oSelectedEmployeeChange = oEmployeeChangeModel.getProperty("/selectedEmployeeChange");
        //     let sZexholderDesc = oSelectedEmployeeChange ? oSelectedEmployeeChange.Value : "";
        
        //     let oPayload = {
        //         RequestId: "00000000-0000-0000-0000-000000000000",
        //         EmployeeNumber: oSelectedEmp,
        //         Status: "S",
        //         PicNumber: sLoggedInEmployeeId,
        //         Massg: this.byId("reasonMutation").getValue(),
        //         ZbegdaEfktf: getFormattedDate("effectiveDateStartMutation"),
        //         ZenddaEfktf: getFormattedDate("effectiveDateEndMutation"),
        //         PlansDest: this.byId("newPositionIdMutation").getValue(),
        //         PersgDest: this.byId("newEmployeeGroupIdMutation").getValue(),
        //         PerskDest: this.byId("newEmployeeSubgroupIdMutation").getValue(),
        //         WerksDest: this.byId("newPerAreaIdMutation").getValue(),
        //         BtrtlDest: this.byId("newPerSubAreaIdMutation").getValue(),
        //         Adjstmn: this.getView().getModel("dropdown").getProperty("/selectedSalaryAdj") || "",
        //         Zsalary: this.byId("salaryAdjValueMutation").getValue() ? this.byId("salaryAdjValueMutation").getValue().replace(/\D/g, '') : "0",
        //         Zdasar1: this.getView().getModel("dropdown").getProperty("/selectedAs") || "",
        //         Zexholder: this.byId("employeeChangeMutation").getValue(),
        //         Zdasar2: this.byId("basicConMutation").getValue(),
        //         // Zverify: this.byId("verifyResultMutation").getSelected() ? "1" : "",
        //         // Zbichecking: Zbichecking,
        //         // Znotebicheck: this.byId("hasilBiCheckingMutation").getValue(),
        //         // ZrekomHcm: this.byId("rekomendasiHCMMutation").getValue(),
        //         // Zdisposisi: (parseInt(this.getView().getModel("disposisiMutation").getProperty("/selectedIndex")) + 1).toString(),
        //         // Znotedisp: this.byId("dispoNoteMutation").getValue(),
        //         // Zsalaryfnl: this.byId("gajiMutation").getValue() ? this.byId("gajiMutation").getValue().replace(/\D/g, '') : "0",
        //         PlansDesc_Dest: sPlansDestDesc,
        //         WerksDestDesc: sWerksDestDesc,
        //         BtrtlDestDesc: sBtrtlDestDesc,
        //         PersgDestDesc: sPersgDestDesc,
        //         PerskDestDesc: sPerskDestDesc,
        //         ZexholderDesc: sZexholderDesc,
        //         MassgDesc: sMassgDesc
        //     };
        
        //     console.log("Mutation Payload:", oPayload);
        
        //     // Show busy dialog
        //     if (!this._oBusyDialog) {
        //         this._oBusyDialog = new sap.m.BusyDialog();
        //     }
        //     this._oBusyDialog.setTitle("Please wait...");
        //     this._oBusyDialog.setText("Submitting request...");
        //     this._oBusyDialog.open();
        
        //     // Submit mutation data
        //     let oModel = this.getOwnerComponent().getModel();
        //     oModel.create("/RequestSet", oPayload, {
        //         success: (oData) => {
        //             this._oBusyDialog.close();
        //             this.onSubmitFiles(oData.RequestId);
        
        //             // Show success message
        //             sap.m.MessageToast.show("Request submitted successfully.");
        //             MessageBox.show("Request has been submitted successfully.", {
        //                 icon: MessageBox.Icon.SUCCESS,
        //                 title: "Success"
        //             });
        //         },
        //         error: (oError) => {
        //             this._oBusyDialog.close();
                    
        //             // Show error message
        //             if (oError) {
        //                 try {
        //                     let oErrorMessage = JSON.parse(oError.responseText);
        //                     MessageBox.error(oErrorMessage.error.message.value);
        //                 } catch (e) {
        //                     MessageBox.error("Error submitting request: " + oError.message);
        //                 }
        //             } else {
        //                 MessageBox.error("Unknown error occurred while submitting request.");
        //             }
        //         },
        //         urlParameters: {
        //             "sap-client": "110"
        //         }
        //     });
        // },

        // _submitDocument: function (sRequestId) {
        //     let oView = this.getView();
        //     let oDocUploadModel = oView.getModel("docUploads");
        //     let aUploads = oDocUploadModel.getProperty("/uploads");
        
        //     if (!aUploads || aUploads.length === 0) {
        //         this._oBusyDialog.close();
        //         MessageToast.show("Mutation submitted successfully without documents.");
        //         return;
        //     }
        
        //     let oModel = this.getOwnerComponent().getModel();
        //     let aPromises = aUploads.map((oDoc) => {
        //         let oPayload = {
        //             RequestId: sRequestId,
        //             FileName: oDoc.fileName,
        //             FileType: oDoc.fileType,
        //             FileSize: oDoc.fileSize.toString(),
        //             DocType: oDoc.docType,
        //             DocTypeText: oDoc.docTypeText,
        //             PIC: oDoc.pic,
        //             Description: oDoc.keterangan
        //         };
        
        //         return new Promise((resolve, reject) => {
        //             oModel.create("/FileAttachmentSet", oPayload, {
        //                 success: (oData) => {
        //                     console.log("Document uploaded successfully:", oData);
        //                     resolve(oData);
        //                 },
        //                 error: (oError) => {
        //                     console.error("Error uploading document:", oError);
        //                     reject(oError);
        //                 }
        //             });
        //         });
        //     });
        
        //     Promise.all(aPromises)
        //         .then(() => {
        //             this._oBusyDialog.close();
        //             MessageToast.show("Mutation and documents submitted successfully.");
        //         })
        //         .catch((oError) => {
        //             this._oBusyDialog.close();
        //             MessageBox.error("Failed to upload one or more documents. Please try again.");
        //         });
        // },

        onEffectiveDateStartChange: function(oEvent) {
            var oView = this.getView();
            var oStartDatePicker = oView.byId("effectiveDateStartMutation");
            var oEndDatePicker = oView.byId("tanggalBerakhirMutation");
            var oStartDate = oStartDatePicker.getDateValue();

            if (oStartDate instanceof Date && !isNaN(oStartDate)) {
                // Add 4 years
                var oEndDate = new Date(oStartDate);
                oEndDate.setFullYear(oEndDate.getFullYear() + 4);
                // Subtract 1 day
                oEndDate.setDate(oEndDate.getDate() - 1);

                // Set value to tanggalBerakhirMutation if valid
                if (oEndDate instanceof Date && !isNaN(oEndDate)) {
                    oEndDatePicker.setDateValue(oEndDate);
                } else {
                    oEndDatePicker.setValue("");
                }
            } else {
                oEndDatePicker.setValue("");
            }
        },

        _loadEmployeeChangeData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
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
                    // Bind the employee model to the dialog
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
                this.byId("employeeChangeMutation").setValue(oSelectedItem.Key);
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        onEmployeeChangeInput: function (oEvent) {
            const sValue = oEvent.getParameter("value");
            const oEmployeeChangeModel = this.getView().getModel("employeechange");
            const oSelectedEmployee = oEmployeeChangeModel.getProperty("/selectedEmployeeChange");
        
            // Check if the entered value matches the selected employee
            if (!oSelectedEmployee || sValue !== oSelectedEmployee.Key) {
                // Reset the field to the last valid selection
                this.byId("employeeChangeMutation").setValue(oSelectedEmployee ? oSelectedEmployee.Key : "");
                MessageBox.warning("Please select a valid employee from the list.");
            }
        },

        _loadReasonData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
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
                    // Bind the employee model to the dialog
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

        handleCloseReason: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oReasonModel = this.getView().getModel("reason");
                
                oReasonModel.setProperty("/selectedReason", oSelectedItem);
                this.byId("reasonMutation").setValue(oSelectedItem.Key);
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
                const oModel = this.getOwnerComponent().getModel();
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
                this.byId("newPositionIdMutation").setValue(oSelectedItem.Key);

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

        // handleClosePosition: function (oEvent) {
        //     let aContexts = oEvent.getParameter("selectedContexts");
        //     if (aContexts && aContexts.length) {
        //         let oSelectedItem = aContexts[0].getObject();
        //         let oPositionModel = this.getView().getModel("position");
        
        //         // Update the selected position in the position model
        //         oPositionModel.setProperty("/selectedPosition", oSelectedItem);
        //         this.byId("newPositionIdMutation").setValue(oSelectedItem.Key);

        //         let oGroupModel = this.getView().getModel("group");
        //         if (oGroupModel) {
        //             oGroupModel.setProperty("/selectedGroup", null);
        //         }
        //         let oSubGroupModel = this.getView().getModel("subGroup");
        //         if (oSubGroupModel) {
        //             oSubGroupModel.setProperty("/selectedSubGroup", null);
        //         }
        //         let oAreaModel = this.getView().getModel("area");
        //         if (oAreaModel) {
        //             oAreaModel.setProperty("/selectedArea", null);
        //         }
        //         let oSubAreaModel = this.getView().getModel("subArea");
        //         if (oSubAreaModel) {
        //             oSubAreaModel.setProperty("/selectedSubArea", null);
        //         }
        
        //         // Update the newUnitOrgIdMutation field with the corresponding Key2
        //         // if (oEmployeeDetailModel) {
        //         //     oEmployeeDetailModel.setProperty("/EmployeeOrgunitId", oSelectedItem.Key2);
        //         //     oEmployeeDetailModel.setProperty("/EmployeeOrgunitLongtext", oSelectedItem.KeyDesc2); // Update KeyDesc2 for newUnitOrgTextMutation
        //         // } else {
        //         //     console.error("EmployeeDetail model is not available.");
        //         // }
        //     }
        
        //     // Clear the filter after closing the dialog
        //     oEvent.getSource().getBinding("items").filter([]);
        // },

        // handleClosePosition: function(oEvent) {
        //     let aContexts = oEvent.getParameter("selectedContexts");
        //     if (aContexts && aContexts.length) {
        //         let oSelectedItem = aContexts[0].getObject();
        //         let oPositionModel = this.getView().getModel("position");
                
        //         oPositionModel.setProperty("/selectedPosition", oSelectedItem);
        //         this.byId("newPositionIdMutation").setValue(oSelectedItem.Key);
        //     }
        //     oEvent.getSource().getBinding("items").filter([]);
        // },

        _loadAreaData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
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
                this.byId("newPerAreaIdMutation").setValue(oSelectedItem.Key);
        
                // Clear the selected sub-area when a new area is selected
                let oSubAreaModel = this.getView().getModel("subArea");
                oSubAreaModel.setProperty("/selectedSubArea", null);
                this.byId("newPerSubAreaIdMutation").setValue("");
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadSubAreaData: function () {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel(); // Use the global model
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
                    this.byId("newPerSubAreaIdMutation").setValue(oSelectedItem.Key2);
                } else {
                    console.error("SubArea model is not initialized.");
                }
            }
        
            // Clear the filter after closing the dialog
            oEvent.getSource().getBinding("items").filter([]);
        },

        // _loadGroupData: function() {
        //     return new Promise((resolve, reject) => {
        //         const oModel = this.getOwnerComponent().getModel();
        //         oModel.read("/ValueHelpGrup", {
        //             success: (oData) => {
        //                 const oGroupModel = new JSONModel(oData.results);
        //                 this.getView().setModel(oGroupModel, "group");
        //                 resolve();
        //             },
        //             error: (oError) => {
        //                 MessageBox.error("Failed to load group data.");
        //                 reject(oError);
        //             }
        //         });
        //     });
        // },

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

        isVerifyMutation: function(oEvent) {
            var oViewModel = this.getView().getModel("viewModel");
            var bSelected = oEvent.getSource().getSelected();
            oViewModel.setProperty("/isVerifyMutation", bSelected);
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
                    this.byId("newEmployeeGroupIdMutation").setValue(oSelectedItem.Key);
                } else {
                    console.error("Group model is not initialized.");
                }

                let oSubGroupModel = this.getView().getModel("subGroup");
                if (oSubGroupModel) {
                    let oSubGroupData = oSubGroupModel.getData();
                    if (oSubGroupData) {
                        oSubGroupData.selectedSubGroup = null;
                        oSubGroupModel.setProperty("/selectedSubGroup", null);
                        this.byId("newEmployeeSubgroupIdMutation").setValue(""); 
                        oSubGroupModel.setData(oSubGroupData);
                    }
                } else {
                    console.error("SubGroup model is not initialized.");
                }
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        // _loadGroupData: function() {
        //     return new Promise((resolve, reject) => {
        //         const oModel = this.getOwnerComponent().getModel();
        //         oModel.read("/ValueHelpGrup", {
        //             success: (oData) => {
        //                 // Set the group model as a flat array (root)
        //                 let oGroupModel = this.getView().getModel("group");
        //                 if (!oGroupModel) {
        //                     oGroupModel = new sap.ui.model.json.JSONModel(oData.results);
        //                     this.getView().setModel(oGroupModel, "group");
        //                 } else {
        //                     oGroupModel.setData(oData.results);
        //                 }
        //                 resolve();
        //             },
        //             error: (oError) => {
        //                 MessageBox.error("Failed to load group data.");
        //                 reject(oError);
        //             }
        //         });
        //     });
        // },

        // handleValueHelpGroup: function() {
        //     if (!this._oValueHelpGroupDialog) {
        //         Fragment.load({
        //             name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpGroup",
        //             controller: this
        //         }).then(function(oDialog) {
        //             this._oValueHelpGroupDialog = oDialog;
        //             // Bind the group model (flat array) to the dialog
        //             this._oValueHelpGroupDialog.setModel(this.getView().getModel("group"), "group");
        //             // Bind the selection model
        //             this._oValueHelpGroupDialog.setModel(this.getView().getModel("groupSelection"), "groupSelection");
        //             this.getView().addDependent(this._oValueHelpGroupDialog);

        //             this._loadGroupData().then(() => {
        //                 this._oValueHelpGroupDialog.open();
        //             });
        //         }.bind(this));
        //     } else {
        //         this._oValueHelpGroupDialog.open();
        //     }
        // },

        // handleSearchGroup: function (oEvent) {
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

        // handleCloseGroup: function (oEvent) {
        //     const aContexts = oEvent.getParameter("selectedContexts");
        //     if (aContexts && aContexts.length) {
        //         const oSelectedItem = aContexts[0].getObject();
        //         // Store selection in a separate model
        //         let oGroupSelectionModel = this.getView().getModel("groupSelection");
        //         if (!oGroupSelectionModel) {
        //             oGroupSelectionModel = new sap.ui.model.json.JSONModel({ selectedGroup: oSelectedItem });
        //             this.getView().setModel(oGroupSelectionModel, "groupSelection");
        //         } else {
        //             oGroupSelectionModel.setProperty("/selectedGroup", null);
        //             oGroupSelectionModel.setProperty("/selectedGroup", oSelectedItem);
        //         }
        //         // No need to set the value manually if using binding
        //         // Clear the selected sub-group when group changes
        //         let oSubGroupModel = this.getView().getModel("subGroup");
        //         if (oSubGroupModel) {
        //             let oSubGroupData = oSubGroupModel.getData();
        //             if (oSubGroupData) {
        //                 oSubGroupData.selectedSubGroup = {};
        //                 this.byId("newEmployeeSubgroupIdMutation").setValue(""); 
        //                 oSubGroupModel.setData(oSubGroupData);
        //             }
        //         } else {
        //             console.error("SubGroup model is not initialized.");
        //         }
        //     }
        //     // Always clear filters after dialog closes
        //     oEvent.getSource().getBinding("items").filter([]);
        // },

        // // onGroupInputChange: function(oEvent) {
        // //     var sValue = oEvent.getParameter("value");
        // //     if (!sValue) {
        // //         this.byId("newEmployeeGroupIdMutation").setValue("");
        // //         this.byId("newEmployeeGroupTextMutation").setText("");
        // //     }
        // // },

        // onGroupInputChange: function(oEvent) {
        //     var sValue = oEvent.getParameter("value");
        //     var oGroupSelectionModel = this.getView().getModel("groupSelection");
        //     var oGroupModel = this.getView().getModel("group");
        //     var aGroups = oGroupModel ? oGroupModel.getData() : [];

        //     if (!sValue) {
        //         // Clear display and model selection
        //         this.byId("newEmployeeGroupIdMutation").setValue("");
        //         this.byId("newEmployeeGroupTextMutation").setText("");
        //         if (oGroupSelectionModel) {
        //             oGroupSelectionModel.setProperty("/selectedGroup", {}); // Clear the model selection!
        //         }
        //     } else if (aGroups && Array.isArray(aGroups)) {
        //         // If user types a value that matches a group key, set the selection in the model
        //         var oFound = aGroups.find(function(o) { return o.Key === sValue; });
        //         if (oFound && oGroupSelectionModel) {
        //             oGroupSelectionModel.setProperty("/selectedGroup", oFound);
        //             this.byId("newEmployeeGroupTextMutation").setText(oFound.Value || "");
        //         }
        //     }
        // },

        // onGroupInputChange: function(oEvent) {
        //     var sValue = oEvent.getParameter("value");
        //     var oGroupSelectionModel = this.getView().getModel("groupSelection");
        //     if (!sValue && oGroupSelectionModel) {
        //         oGroupSelectionModel.setProperty("/selectedGroup", {}); // Only clear the selection
        //     }
        // },

        _loadSubGroupData: function () {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel(); 
                oModel.read("/ValueHelpSubGrupSet", {
                    success: (oData) => {
                        const oSubGroupModel = this.getOwnerComponent().getModel("subGroup");
        
                        if (oSubGroupModel) {
                            // Update the subGroup model's data
                            oSubGroupModel.setProperty("/items", oData.results);
                            console.log("SubGroup data loaded:", oData.results); // Debugging
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
    
        // handleValueHelpSubGroup: function () {
        //     if (!this._oValueHelpSubGroupDialog) {
        //         Fragment.load({
        //             name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpSubGroup",
        //             controller: this
        //         }).then(function (oDialog) {
        //             this._oValueHelpSubGroupDialog = oDialog;
        
        //             // Set the subGroup model to the dialog
        //             const oSubGroupModel = this.getView().getModel("subGroup");
        //             if (!oSubGroupModel) {
        //                 console.error("SubGroup model is not initialized.");
        //                 return;
        //             }
        //             this._oValueHelpSubGroupDialog.setModel(oSubGroupModel, "subGroup");
        //             this.getView().addDependent(this._oValueHelpSubGroupDialog);
        
        //             // Load sub-group data and open the dialog
        //             this._loadSubGroupData().then(() => {
        //                 const sSelectedGroupKey = this.getView().getModel("group").getProperty("/selectedGroup/Key");
        //                 if (sSelectedGroupKey) {
        //                     const oBinding = this._oValueHelpSubGroupDialog.getBinding("items");
        //                     if (oBinding) {
        //                         oBinding.filter(new Filter("Key", FilterOperator.EQ, sSelectedGroupKey));
        //                     }
        //                 }
        //                 this._oValueHelpSubGroupDialog.open();
        //             });
        //         }.bind(this));
        //     } else {
        //         // Apply filter and open the dialog if it already exists
        //         const sSelectedGroupKey = this.getView().getModel("group").getProperty("/selectedGroup/Key");
        //         if (sSelectedGroupKey) {
        //             const oBinding = this._oValueHelpSubGroupDialog.getBinding("items");
        //             if (oBinding) {
        //                 oBinding.filter(new Filter("Key", FilterOperator.EQ, sSelectedGroupKey));
        //             }
        //         }
        //         this._oValueHelpSubGroupDialog.open();
        //     }
        // },

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
                        // Use selected group key for filtering
                        const sSelectedGroupKey = this.getView().getModel("group").getProperty("/selectedGroup/Key");
                        if (sSelectedGroupKey) {
                            const oBinding = this._oValueHelpSubGroupDialog.getBinding("items");
                            if (oBinding) {
                                oBinding.filter(new sap.ui.model.Filter("Key", sap.ui.model.FilterOperator.EQ, sSelectedGroupKey));
                            }
                        }
                        this._oValueHelpSubGroupDialog.open();
                    });
                }.bind(this));
            } else {
                // Apply filter and open the dialog if it already exists
                const sSelectedGroupKey = this.getView().getModel("group").getProperty("/selectedGroup/Key");
                if (sSelectedGroupKey) {
                    const oBinding = this._oValueHelpSubGroupDialog.getBinding("items");
                    if (oBinding) {
                        oBinding.filter(new sap.ui.model.Filter("Key", sap.ui.model.FilterOperator.EQ, sSelectedGroupKey));
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
                    // Update the selectedSubGroup property
                    oSubGroupModel.setProperty("/selectedSubGroup", oSelectedItem);

                    // Update the input field with the selected sub-group's Key2
                    this.byId("newEmployeeSubgroupIdMutation").setValue(oSelectedItem.Key2);
                } else {
                    console.error("SubGroup model is not initialized.");
                }
            }

            // Clear the filter after closing the dialog
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

        onSalaryAdjChange: function (oEvent) {
            const sSelectedKey = oEvent.getSource().getSelectedKey();
            const oModel = this.getView().getModel("dropdown");
        
            if (sSelectedKey === "1") { // "Ya"
                oModel.setProperty("/isSalaryAdjEnabled", true);
            } else if (sSelectedKey === "2") { // "Tidak"
                oModel.setProperty("/isSalaryAdjEnabled", false);
                this.byId("salaryAdjValueMutation").setValue(""); // Clear the input value
            }
        },

        // onAsFieldChange: function (oEvent) {
        //     const sSelectedAs = oEvent.getSource().getSelectedKey(); 
        //     const oModel = this.getView().getModel("dropdown"); 
        
        //     if (sSelectedAs === "1") {
        //         oModel.setProperty("/isEmployeeChangeEnabled", true);
        //     } else if (sSelectedAs === "2") {
        //         oModel.setProperty("/isEmployeeChangeEnabled", false); 
        //         oModel.setProperty("/selectedEmployeeChange/Key", ""); 
        //         oModel.setProperty("/selectedEmployeeChange/Value", ""); 
        //     }
        // },

        // onDisplayDocumentWarning: function () {
        //     MessageToast.show("Display Document button pressed");
        // },
        
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

        //     const oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
        //     const sBatchGroupId = oBundle.getText("batchcratt");
        //     oModel.setDeferredGroups([sBatchGroupId]);
        
        //     this._oBusy.open();
        
        //     const processNextFile = (index) => {
        //         if (index >= aFiles.length) {
        //             this._oBusy.close();
        //             MessageBox.success("All files uploaded successfully.", {
        //                 onClose: () => {
        //                     console.log("File upload process completed.");
        //                 }
        //             });
        //             return;
        //         }
        
        //         const oFile = aFiles[index];
        
        //         const oPayload = {
        //             Reqid: sRequestId,
        //             Seqnr: index.toString(),
        //             FileName: oFile.FileName,
        //             FileType: oFile.FileType,
        //             FileSize: oFile.FileSize.toString(),
        //             Attachment: oFile.Attachment,
        //             CreatedOn: new Date().toISOString().split('.')[0], 
        //             TypeDoc: "BI Checking",
        //             PicPosition: "Compensation & Benefit",
        //             PicName: "Roy",
        //             PicId: "81000061",
        //             Url: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("urlpath", [sRequestId, index, 'Mdt'])
        //         };
        
        //         console.log("Uploading file:", oFile.FileName);
        //         console.log("Payload:", JSON.stringify(oPayload));
        
        //         oModel.create("/FileAttachmentSet", oPayload, {
        //             success: function () {
        //                 console.log("File uploaded successfully:", oFile.FileName);
        //                 processNextFile(index + 1);
        //             },
        //             error: function (oError) {
        //                 this._oBusy.close();

        //                 console.error("Error response:", oError);
        
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
        
        //     processNextFile(0);
        // },

        onFileSizeExceed: function (oEvent) {
            MessageBox.show(oBundle.getText("sizelimit"));
        },
        
        // onSubmitFiles: function (sRequestId) {
        //     const oModel = this.getOwnerComponent().getModel();
        //     const oFileAttachmentModel = this.getView().getModel("fileAttachment");
        //     const aFiles = oFileAttachmentModel.getProperty("/results");
        
        //     if (!aFiles || aFiles.length === 0) {
        //         MessageToast.show("No files to upload.");
        //         return;
        //     }

        //     const oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle(); // Get the i18n resource bundle
        //     const sBatchGroupId = oBundle.getText("batchcratt"); // Batch group ID
        //     oModel.setDeferredGroups([sBatchGroupId]); // Set the batch group ID
        
        //     const aPromises = aFiles.map((oFile, i) => {
        //         const oPayload = {
        //             RequestId: sRequestId,
        //             SequenceNo: i.toString(),
        //             FileName: oFile.FileName,
        //             FileType: oFile.FileType,
        //             FileSize: oFile.FileSize,
        //             Attachment: oFile.Attachment, // Use the Base64 string directly
        //             CreatedOn: new Date(),
        //             TypeDoc: "BI Checking",
        //             PicPosition: "Compensation & Benefit",
        //             PicName: "Roy",
        //             PicId: "81000061",
        //             Url: oBundle.getText("urlpath", [sRequestId, i, "110"])
        //         };
        
        //         return new Promise((resolve, reject) => {
        //             oModel.create("/FileAttachmentSet", oPayload, {
        //                 // groupId: sBatchGroupId,
        //                 // method: "POST",
        //                 success: resolve,
        //                 error: reject
        //             });
        //         });
        //     });
        
        //     Promise.all(aPromises)
        //     .then(() => {
        //         oModel.submitChanges({
        //             groupId: sBatchGroupId,
        //             success: () => {
        //                 MessageToast.show("All files uploaded successfully.");
        //             },
        //             error: () => {
        //                 MessageBox.error("Failed to upload one or more files.");
        //             }
        //         });
        //     })
        //     .catch(() => {
        //         MessageBox.error("Failed to upload one or more files.");
        //     });
        // },
    });
});