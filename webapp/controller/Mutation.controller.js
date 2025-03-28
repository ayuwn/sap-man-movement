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

            let oRequestorModel = new JSONModel({
                EmployeeNumber: "81000038"
            });
            this.getView().setModel(oRequestorModel, "requestor");

            let oDocUploadModel = new JSONModel({
                uploads: []
            });
            this.getView().setModel(oDocUploadModel, "docUploads");

            const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: [] });
            this.getView().setModel(oFileAttachmentModel, "fileAttachment");

            let oDropdownModel = new JSONModel({
                selectedPIC: "",
                selectedJenisDokumen: "",
                selectedSalaryAdj: "",
                selectedAs: "",

                jenisDokumenColl: [
                    { key: "1", text: "Evaluasi Karyawan" },
                    { key: "2", text: "PKWT Terakhir" },
                    { key: "3", text: "Assessment" },
                    { key: "4", text: "Hasil BI Checking" },
                    { key: "5", text: "Disposisi" },
                    { key: "6", text: "PKWT Baru" }
                ],
                PICColl: [
                    { key: "1", text: "Requestor" },
                    { key: "2", text: "Talent & Management" },
                    { key: "3", text: "Compensation & Benefit" },
                    { key: "4", text: "Data Management" },
                ],

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

            let oSubGroupModel = this.getOwnerComponent().getModel("subGroup");
            this.getView().setModel(oSubGroupModel, "subGroup");

            let oSubAreaModel = this.getOwnerComponent().getModel("subArea");
            this.getView().setModel(oSubAreaModel, "subArea");
        },

        _onMutationRouteMatched: function (oEvent) {
            const EmployeeNumber = oEvent.getParameter("arguments").EmployeeNumber;
            if (EmployeeNumber) {
                this._getEmployeeData(EmployeeNumber);
            }

             // Clear any existing files in the upload set
             const oUploadSet = this.byId("idUploadSet");
             if (oUploadSet) {
                 oUploadSet.removeAllItems();
             }
             
             // Reset the file attachment model
             const oFileAttachmentModel = this.getView().getModel("fileAttachment");
             if (oFileAttachmentModel) {
                 oFileAttachmentModel.setProperty("/results", []);
             }
             
             // Get request ID from route parameters
             var oArguments = oEvent.getParameter("arguments");
             
             if (oArguments && oArguments.requestId) {
                 this._sRequestId = oArguments.requestId;
                 this._getRequestData();
             } else {
                 // Try to get from application model if we're coming from another view
                 var oAppModel = this.getModel("appModel");
                 if (oAppModel && oAppModel.getProperty("/selectedRequest")) {
                     this._sRequestId = oAppModel.getProperty("/selectedRequest/RequestId");
                     this._getRequestData();
                 } else {
                     M.information("No request selected");
                     this.onNavBack();
                 }
            }
        },

        _getEmployeeData: function (EmployeeNumber) {
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
                })
                .catch((error) => {
                    console.error("Error loading employee data:", error);
                    MessageBox.error("Error loading employee details");
                })
                .finally(() => {
                    this._oBusy.close();
                });
        },

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

        onOpenDialog: function () {
            var oView = this.getView();

            // Create dialog lazily
            if (!this._oDialog) {
                // Load and create fragment asynchronously
                Fragment.load({
                    id: oView.getId(),
                    name: "bsim.hcmapp.man.movement.view.fragments.DocumentUpload",
                    controller: this
                }).then(function (oDialog) {
                    this._oDialog = oDialog;
                    // Connect dialog to view's lifecycle management
                    oView.addDependent(this._oDialog);
                    this._oDialog.setModel(this.getView().getModel("dropdown"), "dropdown");
                    this._oDialog.open();
                }.bind(this));
            } else {
                this._oDialog.open();
            }
        },

        onDialogClose: function () {
            if (this._oDialog) {
                this._oDialog.close();
            }
        },

        onDialogSubmit: function () {
            let oView = this.getView();
            
            if (!this._oDialog) {
                console.error("Dialog belum dimuat.");
                return;
            }

            // Retrieve fragment controls using the fixed fragment ID ("documentUploadDialog")
            let oDocTypeSelect = Fragment.byId(oView.getId(), "docTypeSelect");
            let oPicSelect = Fragment.byId(oView.getId(), "picSelect");
            let oKeteranganInput = Fragment.byId(oView.getId(), "keteranganInput");
            let oFileUploader = Fragment.byId(oView.getId(), "fileUploader");

            if (!oDocTypeSelect || !oPicSelect || !oKeteranganInput || !oFileUploader) {
                console.error("Salah satu elemen dalam fragment tidak ditemukan.");
                return;
            }

            // Get selected document type key and text
            let sDocTypeKey   = oDocTypeSelect.getSelectedKey();
            let sDocTypeText  = oDocTypeSelect.getSelectedItem() ? oDocTypeSelect.getSelectedItem().getText() : "";
            // // Get selected PIC text from the picSelect control
            let sPICText      = oPicSelect.getSelectedItem() ? oPicSelect.getSelectedItem().getText() : "";
            // Get keterangan input and file uploader value
            let sKeterangan   = oKeteranganInput.getValue();
            let sFileValue    = oFileUploader.getValue();

            if (!sFileValue) {
                MessageBox.error("Dokumen harus diunggah.");
                return;
            }

            let sFileSize = oFileUploader.oFileUpload.files[0].size;
            let sFileName = sFileValue.split("\\").pop();
            let sFileType = sFileValue.split('.').pop().toLowerCase();

            // Validate file type
            if (sFileType !== "pdf") {
                MessageBox.error(this.getResourceBundle().getText("msgDocType"));
                return false;
            }

            // Check if document is blank
            if (!sFileValue) {
                MessageBox.error(this.getResourceBundle().getText("msgMissingDoc"));
                return false;
            }
            
            let sFileUrl      = "/uploads/" + + sFileName;
            
            // Prepare new document item
            let oNewDoc = {
                docType: sDocTypeKey,
                docTypeText: sDocTypeText,
                keterangan: sKeterangan,
                fileUrl: sFileUrl,
                fileSize: sFileSize,
                fileName: sFileName,
                pic: sPICText
            };

            let isValid = this._validateEntries(this._oDialog, "grpValidation");
            if (!isValid) {
                return false;
            }

            // Add new document to the "docUploads" model
            let oDocUploadModel = oView.getModel("docUploads");
            let aUploads = oDocUploadModel.getProperty("/uploads");
            aUploads.push(oNewDoc);
            oDocUploadModel.setProperty("/uploads", aUploads);
            
            // Clear fields then close dialog
            oDocTypeSelect.setSelectedKey("");
            oPicSelect.setSelectedKey("");
            oKeteranganInput.setValue("");
            oFileUploader.setValue("");
            this._oDialog.close();
        },
        
        onShowDoc: function(oEvent) {
            // Get the binding context from the pressed link
            const oSource = oEvent.getSource();
            const oBindingContext = oSource.getBindingContext("docUploads");
            
            if (!oBindingContext) {
                MessageToast.show("Document information not found.");
                return;
            }
            
            // Get the document details from the context
            const oDocItem = oBindingContext.getObject();
            console.log("Document to preview:", oDocItem);
            
            if (!oDocItem || !oDocItem.fileName) {
                MessageToast.show("Document file not found.");
                return;
            }
            
            // For PDF preview, let's use a dialog with PDF viewer
            if (!this._pdfViewerDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.grievance.view.fragments.PDFViewer",
                    controller: this
                }).then(function(oDialog) {
                    this._pdfViewerDialog = oDialog;
                    this.getView().addDependent(this._pdfViewerDialog);
                    this._pdfViewerDialog.open();
                    
                    // Wait for dialog to be rendered before setting content
                    setTimeout(function() {
                        this._showPdfInDialog(oDocItem);
                    }.bind(this), 300);
                    
                }.bind(this)).catch(function(err) {

                    MessageToast.show("Error loading PDF viewer. See console for details.");
                });
            } else {
                this._pdfViewerDialog.open();
                // Use timeout to ensure dialog is rendered before accessing the iframe
                setTimeout(function() {
                    this._showPdfInDialog(oDocItem);
                }.bind(this), 300);
            }
        },

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

        _postRequest: function () {
            // Prepare mutation payload
            let oEmployeeModel = this.getView().getModel("employee");
            let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
        
            let oCurrentUserModel = this.getView().getModel("currentUser");
            let sLoggedInEmployeeId = oCurrentUserModel ? oCurrentUserModel.getProperty("/EmployeeNumber") : null;

            if (!sLoggedInEmployeeId) {
                MessageBox.error("Unable to retrieve logged-in user details.");
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

            const checkboxIds = ["hasilMutation1", "hasilMutation2", "hasilMutation3", "hasilMutation4", "hasilMutation5"];
            let Zbichecking = checkboxIds
                .map(id => this.byId(id))
                .filter(checkbox => checkbox && checkbox.getSelected())
                .map(checkbox => checkbox.getText())
                .join(",");

            // Retrieve the position description from the ValueHelpPositionSet model
            let oPositionModel = this.getView().getModel("position");
            let oSelectedPosition = oPositionModel.getProperty("/selectedPosition");
            let sPlansDestDesc = oSelectedPosition ? oSelectedPosition.Value : "";

            let oAreaModel = this.getView().getModel("area");
            let oSelectedArea = oAreaModel.getProperty("/selectedArea");
            let sWerksDestDesc = oSelectedArea ? oSelectedArea.Value : "";

            let oReasonModel = this.getView().getModel("reason");
            let oSelectedReason = oReasonModel.getProperty("/selectedReason");
            let sMassgDesc = oSelectedReason ? oSelectedReason.Value : "";
        
            // Retrieve the sub-area description from the ValueHelpSubArea model
            let oSubAreaModel = this.getView().getModel("subArea");
            let oSelectedSubArea = oSubAreaModel.getProperty("/selectedSubArea");
            let sBtrtlDestDesc = oSelectedSubArea ? oSelectedSubArea.Value : "";

            // Retrieve the group description from the ValueHelpGroup model
            let oGroupModel = this.getView().getModel("group");
            let oSelectedGroup = oGroupModel.getProperty("/selectedGroup");
            let sPersgDestDesc = oSelectedGroup ? oSelectedGroup.Value : "";

            // Retrieve the subgroup description from the ValueHelpSubGroup model
            let oSubGroupModel = this.getView().getModel("subGroup");
            let oSelectedSubGroup = oSubGroupModel.getProperty("/selectedSubGroup");
            let sPerskDestDesc = oSelectedSubGroup ? oSelectedSubGroup.Value : "";

            // Retrieve the employee change description from the ValueHelpNumberSet model
            let oEmployeeChangeModel = this.getView().getModel("employeechange");
            let oSelectedEmployeeChange = oEmployeeChangeModel.getProperty("/selectedEmployeeChange");
            let sZexholderDesc = oSelectedEmployeeChange ? oSelectedEmployeeChange.Value : "";
        
            let oPayload = {
                RequestId: "00000000-0000-0000-0000-000000000000",
                EmployeeNumber: oSelectedEmp,
                Status: "S",
                PicNumber: sLoggedInEmployeeId,
                Massg: this.byId("reasonMutation").getValue(),
                ZbegdaEfktf: getFormattedDate("effectiveDateStartMutation"),
                ZenddaEfktf: getFormattedDate("effectiveDateEndMutation"),
                PlansDest: this.byId("newPositionIdMutation").getValue(),
                PersgDest: this.byId("newEmployeeGroupIdMutation").getValue(),
                PerskDest: this.byId("newEmployeeSubgroupIdMutation").getValue(),
                WerksDest: this.byId("newPerAreaIdMutation").getValue(),
                BtrtlDest: this.byId("newPerSubAreaIdMutation").getValue(),
                Adjstmn: this.getView().getModel("dropdown").getProperty("/selectedSalaryAdj") || "",
                Zsalary: this.byId("salaryAdjValueMutation").getValue() ? this.byId("salaryAdjValueMutation").getValue().replace(/\D/g, '') : "0",
                Zdasar1: this.getView().getModel("dropdown").getProperty("/selectedAs") || "",
                Zexholder: this.byId("employeeChangeMutation").getValue(),
                Zdasar2: this.byId("basicConMutation").getValue(),
                // Zverify: this.byId("verifyResultMutation").getSelected() ? "1" : "",
                // Zbichecking: Zbichecking,
                // Znotebicheck: this.byId("hasilBiCheckingMutation").getValue(),
                // ZrekomHcm: this.byId("rekomendasiHCMMutation").getValue(),
                // Zdisposisi: (parseInt(this.getView().getModel("disposisiMutation").getProperty("/selectedIndex")) + 1).toString(),
                // Znotedisp: this.byId("dispoNoteMutation").getValue(),
                // Zsalaryfnl: this.byId("gajiMutation").getValue() ? this.byId("gajiMutation").getValue().replace(/\D/g, '') : "0",
                PlansDesc_Dest: sPlansDestDesc,
                WerksDestDesc: sWerksDestDesc,
                BtrtlDestDesc: sBtrtlDestDesc,
                PersgDestDesc: sPersgDestDesc,
                PerskDestDesc: sPerskDestDesc,
                ZexholderDesc: sZexholderDesc,
                MassgDesc: sMassgDesc
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
            let oModel = this.getOwnerComponent().getModel();
            oModel.create("/RequestSet", oPayload, {
                success: (oData) => {
                    this._oBusyDialog.close();
                    this.onSubmitFiles(oData.RequestId);
        
                    // Show success message
                    sap.m.MessageToast.show("Request submitted successfully.");
                    MessageBox.show("Request has been submitted successfully.", {
                        icon: MessageBox.Icon.SUCCESS,
                        title: "Success"
                    });
                },
                error: (oError) => {
                    this._oBusyDialog.close();
                    
                    // Show error message
                    if (oError) {
                        try {
                            let oErrorMessage = JSON.parse(oError.responseText);
                            MessageBox.error(oErrorMessage.error.message.value);
                        } catch (e) {
                            MessageBox.error("Error submitting request: " + oError.message);
                        }
                    } else {
                        MessageBox.error("Unknown error occurred while submitting request.");
                    }
                },
                urlParameters: {
                    "sap-client": "110"
                }
            });
        },

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
                this.byId("employeeChangeMutation").setValue(oSelectedItem.Key);
            }
            oEvent.getSource().getBinding("items").filter([]);
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
            var oFilter = new Filter("Value", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
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
            var oFilter = new Filter("Value", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },

        handleClosePosition: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oPositionModel = this.getView().getModel("position");
                
                oPositionModel.setProperty("/selectedPosition", oSelectedItem);
                this.byId("newPositionIdMutation").setValue(oSelectedItem.Key);
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadAreaData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
                oModel.read("/ValueHelpArea", {
                    success: (oData) => {
                        const oAreaModel = new JSONModel(oData.results);
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
            var oFilter = new Filter("Value", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
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
                oSubAreaModel.setProperty("/selectedSubArea", {});
                this.byId("newPerSubAreaIdMutation").setValue("");
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        // handleCloseArea: function(oEvent) {
        //     let aContexts = oEvent.getParameter("selectedContexts");
        //     if (aContexts && aContexts.length) {
        //         let oSelectedItem = aContexts[0].getObject();
        //         let oAreaModel = this.getView().getModel("area");

        //         oAreaModel.setProperty("/selectedArea", oSelectedItem);
        //         this.byId("newPerAreaIdMutation").setValue(oSelectedItem.Key);
        //     }
        //     oEvent.getSource().getBinding("items").filter([]);
        // },

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
            var oFilter = new Filter("Value", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
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

        _loadGroupData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
                oModel.read("/ValueHelpGrup", {
                    success: (oData) => {
                        const oGroupModel = new JSONModel(oData.results);
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
                    // Update the selected group
                    oGroupModel.setData({
                        ...oGroupModel.getData(),
                        selectedGroup: oSelectedItem
                    });
                    this.byId("newEmployeeGroupIdMutation").setValue(oSelectedItem.Key);
                } else {
                    console.error("Group model is not initialized.");
                }
        
                // Clear the selected sub-group by directly modifying the subGroup model's data
                let oSubGroupModel = this.getView().getModel("subGroup");
                if (oSubGroupModel) {
                    let oSubGroupData = oSubGroupModel.getData();
                    if (oSubGroupData) {
                        oSubGroupData.selectedSubGroup = {}; // Clear the selected sub-group
                        this.byId("newEmployeeSubgroupIdMutation").setValue(""); // Clear the input field
                        oSubGroupModel.setData(oSubGroupData); // Update the model
                    }
                } else {
                    console.error("SubGroup model is not initialized.");
                }
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadSubGroupData: function () {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel(); // Use the global model
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
    
        handleValueHelpSubGroup: function () {
            if (!this._oValueHelpSubGroupDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpSubGroup",
                    controller: this
                }).then(function (oDialog) {
                    this._oValueHelpSubGroupDialog = oDialog;
        
                    // Set the subGroup model to the dialog
                    const oSubGroupModel = this.getView().getModel("subGroup");
                    if (!oSubGroupModel) {
                        console.error("SubGroup model is not initialized.");
                        return;
                    }
                    this._oValueHelpSubGroupDialog.setModel(oSubGroupModel, "subGroup");
                    this.getView().addDependent(this._oValueHelpSubGroupDialog);
        
                    // Load sub-group data and open the dialog
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
                // Apply filter and open the dialog if it already exists
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
            var oFilter = new Filter("Value", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
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

        onDisplayDocumentWarning: function () {
            MessageToast.show("Display Document button pressed");
        },

        onAfterItemAdded: function (oEvent) {
            const oItem = oEvent.getParameter("item");
            const oFile = oItem.getFileObject();
            const oModel = this.getView().getModel("fileAttachment");
            const aUploadedFiles = oModel ? oModel.getProperty("/results") : [];
        
            if (oFile) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const sBase64 = e.target.result.split(",")[1]; // Remove data:image/... prefix
                    const sFileType = oFile.type || this._getMimeTypeFromExtension(oFile.name); // Detect MIME type
        
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
        
            // Optional: Reset UploadSet value state
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
            return oFileTypes[sExtension] || "application/octet-stream"; // Default to binary if unknown
        },

        onAfterItemRemoved: function (oEvent) {
            const oItem = oEvent.getParameter("item");
            const sFileName = oItem.getFileName();
            const oModel = this.getView().getModel("fileAttachment");
            const aData = oModel.getProperty("/results");
        
            // Filter out the removed file
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
        
            const oModel = this.getOwnerComponent().getModel();
            const oFileAttachmentModel = this.getView().getModel("fileAttachment");
            const aFiles = oFileAttachmentModel ? oFileAttachmentModel.getProperty("/results") : [];
        
            if (!aFiles || aFiles.length === 0) {
                MessageBox.warning("No files to upload. Do you want to continue with submission?", {
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            MessageBox.success("Submission completed without file uploads.");
                        }
                    }.bind(this)
                });
                return;
            }

            // Prepare batch group ID
            const oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            const sBatchGroupId = oBundle.getText("batchcratt");
            oModel.setDeferredGroups([sBatchGroupId]);
        
            // Show busy indicator
            this._oBusy.open();
        
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
                    Seqnr: index.toString(),
                    FileName: oFile.FileName,
                    FileType: oFile.FileType,
                    // FileType: oFile.FileType.split('/')[1] || oFile.FileType, // Extract file extension if MIME type
                    FileSize: oFile.FileSize.toString(),
                    Attachment: oFile.Attachment,
                    CreatedOn: new Date().toISOString().split('.')[0], // Format as ISO without milliseconds
                    TypeDoc: "BI Checking",
                    PicPosition: "Compensation & Benefit",
                    PicName: "Roy",
                    PicId: "81000061",
                    Url: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("urlpath", [sRequestId, index, 'Mdt'])
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
        },

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