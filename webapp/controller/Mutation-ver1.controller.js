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
    var ValueState = CoreLib.ValueState;

    return BaseController.extend("bsim.hcmapp.man.movement.controller.Mutation-fix", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this.setModel(new JSONModel(), "create");
            // this.setModel(new JSONModel({ uploads: [] }), "docUploads");
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
        },

        _onMutationRouteMatched: function (oEvent) {
            const EmployeeNumber = oEvent.getParameter("arguments").EmployeeNumber;
            if (EmployeeNumber) {
                this._getEmployeeData(EmployeeNumber);
            }
        },

        _getEmployeeData: function (EmployeeNumber) {
            const sPath = `/EmployeeDetailSet('${EmployeeNumber}')`; // Path for specific employee
            // console.log("Loading employee data for:", EmployeeNumber);
            
            let oEmployeeModel = this.getView().getModel("employee");
            this._oBusy.open();
            
            oEmployeeModel.loadData(`http://localhost:8080/sap/opu/odata/sap/ZHR_MOVEMENT_MAN_SRV${sPath}?$format=json`, null, true, "GET", false, false, {
                "Content-Type": "application/json"
            });
            
            this.readEntity(sPath).then((result) => {
                if (!result) {
                    MessageBox.error(this.getResourceBundle().getText("msgNotAuthorized"), {
                        actions: ["Exit"],
                        onClose: (sAction) => {
                            this._navBack();
                        },
                    });
                } else {
                    // Set the data to the model
                    oEmployeeModel.setData(result);
                    console.log("Employee Data loaded:", result);
                }   
                this._oBusy.close();
            }).catch((error) => {
                console.error("Error loading employee data:", error);
                this._oBusy.close();
                MessageBox.error("Error loading employee details");
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

        onSendRequest: function() {
            // Get employee model
            let oEmployeeModel = this.getView().getModel("employee");
            let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
          
            let oRequestorModel = this.getView().getModel("requestor");
            let oSelectedReq = oRequestorModel.getProperty("/EmployeeNumber");

            if (!oSelectedEmp) {
                MessageBox.error("Please select an employee first.");
                return;
            }

            // Ensure the user cannot perform actions on themselves
            if (oSelectedEmp === oSelectedReq) {
                MessageBox.error("You cannot perform actions on yourself.");
                return;
            }
    
             // Validate required entries
             var oView = this.getView();
    
             // Validate required entries
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

        _postRequest: function() {
            // Get employee data
            let oEmployeeModel = this.getView().getModel("employee");
            let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");

            let oRequestorModel = this.getView().getModel("requestor");
            let oSelectedReq = oRequestorModel.getProperty("/EmployeeNumber");

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

            // Prepare the payload
            let oPayload = {
                RequestId: "00000000-0000-0000-0000-000000000000",
                EmployeeNumber: oSelectedEmp,
                Status: "S", 
                PicNumber: oSelectedReq, 
                Massg: this.byId("reasonMutation").getValue(),
                ZbegdaEfktf: getFormattedDate("effectiveDateStartMutation"),
                ZenddaEfktf: getFormattedDate("effectiveDateEndMutation"),
                PlansDest: this.byId("newPositionIdMutation").getValue(),
                PersgDest: this.byId("newEmployeeGroupIdMutation").getValue(),
                PerskDest: this.byId("newEmployeeSubgroupIdMutation").getValue(),
                WerksDest: this.byId("newPerAreaIdMutation").getValue(),
                BtrtlDest: this.byId("newPerSubAreaIdMutation").getValue(),
                Adjstmn: this.getView().getModel("dropdown").getProperty("/selectedSalaryAdj") || "",
                Zsalary: this.byId("salaryAdjValueMutation").getValue() ? this.byId("salaryAdjValueMutation").getValue().replace(/\D/g,'') : "0",
                Zdasar1: this.getView().getModel("dropdown").getProperty("/selectedAs") || "",
                Zexholder: this.byId("employeeChangeMutation").getValue(),
                Zdasar2: this.byId("basicConMutation").getValue(),
                Zverify: this.byId("verifyResultMutation").getSelected() ? "1" : "",
                Zbichecking: Zbichecking,
                Znotebicheck: this.byId("hasilBiCheckingMutation").getValue(),
                ZrekomHcm: this.byId("rekomendasiHCMMutation").getValue(),
                Zdisposisi: (parseInt(this.getView().getModel("disposisiMutation").getProperty("/selectedIndex")) + 1).toString(), 
                Znotedisp: this.byId("dispoNoteMutation").getValue(),
                Zsalaryfnl: this.byId("gajiMutation").getValue() ? this.byId("gajiMutation").getValue().replace(/\D/g,'') : "0",
                PlansDesc_Dest: sPlansDestDesc,
                WerksDestDesc: sWerksDestDesc,
                BtrtlDestDesc: sBtrtlDestDesc,
                PersgDestDesc: sPersgDestDesc,
                PerskDestDesc: sPerskDestDesc,
                ZexholderDesc: sZexholderDesc,
                MassgDesc: sMassgDesc
            };

            // Log the payload to ensure PicNumber is set correctly
            console.log("Payload to be sent:", oPayload);

            // Show busy dialog
            if (!this._oBusyDialog) {
                this._oBusyDialog = new sap.m.BusyDialog();
            }
            this._oBusyDialog.setTitle("Please wait...");
            this._oBusyDialog.setText("Submitting request...");
            this._oBusyDialog.open();

            // Send request to backend
            let oModel = this.getOwnerComponent().getModel();
            oModel.create("/RequestSet", oPayload, {
                success: (oData) => {
                    this._oBusyDialog.close();
                    
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

        _loadSubAreaData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
                oModel.read("/ValueHelpSubArea", {
                    success: (oData) => {
                        const oSubAreaModel = new JSONModel(oData.results);
                        this.getView().setModel(oSubAreaModel, "subArea");
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load sub area data.");
                        reject(oError);
                    }
                });
            });
        },

        handleValueHelpSubArea: function() {
            if (!this._oValueHelpSubAreaDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpSubArea",
                    controller: this
                }).then(function(oDialog) {
                    this._oValueHelpSubAreaDialog = oDialog;
                    // Bind the sub-area model to the dialog
                    this._oValueHelpSubAreaDialog.setModel(this.getView().getModel("subArea"), "subArea");
                    this.getView().addDependent(this._oValueHelpSubAreaDialog);
                            
                    this._loadSubAreaData().then(() => {
                        // Filter sub-areas based on selected area key
                        let sSelectedAreaKey = this.getView().getModel("area").getProperty("/selectedArea/Key");
                        let oBinding = this._oValueHelpSubAreaDialog.getBinding("items");
                        oBinding.filter(new Filter("Key", FilterOperator.EQ, sSelectedAreaKey));
                        this._oValueHelpSubAreaDialog.open();
                    });
                    
                }.bind(this));
            } else {
                // Filter sub-areas based on selected area key
                let sSelectedAreaKey = this.getView().getModel("area").getProperty("/selectedArea/Key");
                let oBinding = this._oValueHelpSubAreaDialog.getBinding("items");
                oBinding.filter(new Filter("Key", FilterOperator.EQ, sSelectedAreaKey));
                this._oValueHelpSubAreaDialog.open();
            }
        },

        // handleValueHelpSubArea: function() {
        //     if (!this._oValueHelpSubAreaDialog) {
        //         Fragment.load({
        //             name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpSubArea",
        //             controller: this
        //         }).then(function(oDialog) {
        //             this._oValueHelpSubAreaDialog = oDialog;
        //             // Bind the area model to the dialog
        //             this._oValueHelpSubAreaDialog.setModel(this.getView().getModel("subArea"), "subArea");
        //             this.getView().addDependent(this._oValueHelpSubAreaDialog);
                            
        //             this._loadSubAreaData().then(() => {
        //                 this._oValueHelpSubAreaDialog.open();
        //             });
                    
        //         }.bind(this));
        //     } else {
        //         this._oValueHelpSubAreaDialog.open();
        //     }
        // },

        handleSearchSubArea: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oFilter = new Filter("Value", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },

        handleCloseSubArea: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oSubAreaModel = this.getView().getModel("subArea");
                
                oSubAreaModel.setProperty("/selectedSubArea", oSelectedItem);
                this.byId("newPerSubAreaIdMutation").setValue(oSelectedItem.Key2);
            }
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

        handleCloseGroup: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oGroupModel = this.getView().getModel("group");
                
                oGroupModel.setProperty("/selectedGroup", oSelectedItem);
                this.byId("newEmployeeGroupIdMutation").setValue(oSelectedItem.Key);
                
                // Clear the selected sub-area when a new area is selected
                let oSubGroupModel = this.getView().getModel("subGroup");
                oSubGroupModel.setProperty("/selectedSubGroup", {});
                this.byId("newEmployeeSubgroupIdMutation").setValue("");
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        _loadSubGroupData: function() {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
                oModel.read("/ValueHelpSubGrupSet", {
                    success: (oData) => {
                        const oSubGroupModel = new JSONModel(oData.results);
                        this.getView().setModel(oSubGroupModel, "subGroup");
                        resolve();
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to load sub group data.");
                        reject(oError);
                    }
                });
            });
        },

        handleValueHelpSubGroup: function() {
            if (!this._oValueHelpSubGroupDialog) {
                Fragment.load({
                    name: "bsim.hcmapp.man.movement.view.fragments.ValueHelpSubGroup",
                    controller: this
                }).then(function(oDialog) {
                    this._oValueHelpSubGroupDialog = oDialog;
                    // Bind the area model to the dialog
                    this._oValueHelpSubGroupDialog.setModel(this.getView().getModel("subGroup"), "subGroup");
                    this.getView().addDependent(this._oValueHelpSubGroupDialog);
                     
                    this._loadSubGroupData().then(() => {
                        // Filter sub-areas based on selected area key
                        let sSelectedGroupKey = this.getView().getModel("group").getProperty("/selectedGroup/Key");
                        let oBinding = this._oValueHelpSubGroupDialog.getBinding("items");
                        oBinding.filter(new Filter("Key", FilterOperator.EQ, sSelectedGroupKey));
                        this._oValueHelpSubGroupDialog.open();
                    });
                    
                }.bind(this));
            } else {
                // Filter sub-areas based on selected area key
                let sSelectedGroupKey = this.getView().getModel("group").getProperty("/selectedGroup/Key");
                let oBinding = this._oValueHelpSubGroupDialog.getBinding("items");
                oBinding.filter(new Filter("Key", FilterOperator.EQ, sSelectedGroupKey));
                this._oValueHelpSubGroupDialog.open();
            }
        },

        handleSearchSubGroup: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oFilter = new Filter("Value", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },

        handleCloseSubGroup: function(oEvent) {
            let aContexts = oEvent.getParameter("selectedContexts");
            if (aContexts && aContexts.length) {
                let oSelectedItem = aContexts[0].getObject();
                let oSubGroupModel = this.getView().getModel("subGroup");
                
                oSubGroupModel.setProperty("/selectedSubGroup", oSelectedItem);
                this.byId("newEmployeeSubgroupIdMutation").setValue(oSelectedItem.Key2);
            }
            oEvent.getSource().getBinding("items").filter([]);
        },

        onDisplayDocumentWarning: function () {
            MessageToast.show("Display Document button pressed");
        }
    });
});