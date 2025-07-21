// To parse this data:
//
//   import { Convert, SecretLintOutput } from "./file";
//
//   const secretLintOutput = Convert.toSecretLintOutput(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

/**
 * Static Analysis Results Format (SARIF) Version 2.1.0-rtm.5 JSON Schema: a standard format
 * for the output of static analysis tools.
 */
export interface SecretLintOutput {
	/**
	 * The URI of the JSON schema corresponding to the version.
	 */
	$schema?: string;
	/**
	 * References to external property files that share data between runs.
	 */
	inlineExternalProperties?: ExternalProperties[];
	/**
	 * Key/value pairs that provide additional information about the log file.
	 */
	properties?: PropertyBag;
	/**
	 * The set of runs contained in this log file.
	 */
	runs: Run[];
	/**
	 * The SARIF format version of this log file.
	 */
	version: Version;
}

/**
 * The top-level element of an external property file.
 */
export interface ExternalProperties {
	/**
	 * Addresses that will be merged with a separate run.
	 */
	addresses?: Address[];
	/**
	 * An array of artifact objects that will be merged with a separate run.
	 */
	artifacts?: Artifact[];
	/**
	 * A conversion object that will be merged with a separate run.
	 */
	conversion?: Conversion;
	/**
	 * The analysis tool object that will be merged with a separate run.
	 */
	driver?: ToolComponent;
	/**
	 * Tool extensions that will be merged with a separate run.
	 */
	extensions?: ToolComponent[];
	/**
	 * Key/value pairs that provide additional information that will be merged with a separate
	 * run.
	 */
	externalizedProperties?: PropertyBag;
	/**
	 * An array of graph objects that will be merged with a separate run.
	 */
	graphs?: Graph[];
	/**
	 * A stable, unique identifier for this external properties object, in the form of a GUID.
	 */
	guid?: string;
	/**
	 * Describes the invocation of the analysis tool that will be merged with a separate run.
	 */
	invocations?: Invocation[];
	/**
	 * An array of logical locations such as namespaces, types or functions that will be merged
	 * with a separate run.
	 */
	logicalLocations?: LogicalLocation[];
	/**
	 * Tool policies that will be merged with a separate run.
	 */
	policies?: ToolComponent[];
	/**
	 * Key/value pairs that provide additional information about the external properties.
	 */
	properties?: PropertyBag;
	/**
	 * An array of result objects that will be merged with a separate run.
	 */
	results?: Result[];
	/**
	 * A stable, unique identifier for the run associated with this external properties object,
	 * in the form of a GUID.
	 */
	runGuid?: string;
	/**
	 * The URI of the JSON schema corresponding to the version of the external property file
	 * format.
	 */
	schema?: string;
	/**
	 * Tool taxonomies that will be merged with a separate run.
	 */
	taxonomies?: ToolComponent[];
	/**
	 * An array of threadFlowLocation objects that will be merged with a separate run.
	 */
	threadFlowLocations?: ThreadFlowLocation[];
	/**
	 * Tool translations that will be merged with a separate run.
	 */
	translations?: ToolComponent[];
	/**
	 * The SARIF format version of this external properties object.
	 */
	version?: Version;
	/**
	 * Requests that will be merged with a separate run.
	 */
	webRequests?: WebRequest[];
	/**
	 * Responses that will be merged with a separate run.
	 */
	webResponses?: WebResponse[];
}

/**
 * A physical or virtual address, or a range of addresses, in an 'addressable region'
 * (memory or a binary file).
 *
 * The address of the location.
 */
export interface Address {
	/**
	 * The address expressed as a byte offset from the start of the addressable region.
	 */
	absoluteAddress?: number;
	/**
	 * A human-readable fully qualified name that is associated with the address.
	 */
	fullyQualifiedName?: string;
	/**
	 * The index within run.addresses of the cached object for this address.
	 */
	index?: number;
	/**
	 * An open-ended string that identifies the address kind. 'data', 'function',
	 * 'header','instruction', 'module', 'page', 'section', 'segment', 'stack', 'stackFrame',
	 * 'table' are well-known values.
	 */
	kind?: string;
	/**
	 * The number of bytes in this range of addresses.
	 */
	length?: number;
	/**
	 * A name that is associated with the address, e.g., '.text'.
	 */
	name?: string;
	/**
	 * The byte offset of this address from the absolute or relative address of the parent
	 * object.
	 */
	offsetFromParent?: number;
	/**
	 * The index within run.addresses of the parent object.
	 */
	parentIndex?: number;
	/**
	 * Key/value pairs that provide additional information about the address.
	 */
	properties?: PropertyBag;
	/**
	 * The address expressed as a byte offset from the absolute address of the top-most parent
	 * object.
	 */
	relativeAddress?: number;
}

/**
 * Key/value pairs that provide additional information about the address.
 *
 * Key/value pairs that provide additional information about the object.
 *
 * Key/value pairs that provide additional information about the artifact content.
 *
 * Key/value pairs that provide additional information about the message.
 *
 * Key/value pairs that provide additional information about the artifact location.
 *
 * Key/value pairs that provide additional information about the artifact.
 *
 * Contains configuration information specific to a report.
 *
 * Key/value pairs that provide additional information about the reporting configuration.
 *
 * Key/value pairs that provide additional information about the reporting descriptor
 * reference.
 *
 * Key/value pairs that provide additional information about the toolComponentReference.
 *
 * Key/value pairs that provide additional information about the configuration override.
 *
 * Key/value pairs that provide additional information about the invocation.
 *
 * Key/value pairs that provide additional information about the exception.
 *
 * Key/value pairs that provide additional information about the region.
 *
 * Key/value pairs that provide additional information about the logical location.
 *
 * Key/value pairs that provide additional information about the physical location.
 *
 * Key/value pairs that provide additional information about the location.
 *
 * Key/value pairs that provide additional information about the location relationship.
 *
 * Key/value pairs that provide additional information about the stack frame.
 *
 * Key/value pairs that provide additional information about the stack.
 *
 * Key/value pairs that provide additional information about the notification.
 *
 * Key/value pairs that provide additional information about the conversion.
 *
 * Key/value pairs that provide additional information about the report.
 *
 * Key/value pairs that provide additional information about the tool component.
 *
 * Key/value pairs that provide additional information about the translation metadata.
 *
 * Key/value pairs that provide additional information about the tool.
 *
 * Key/value pairs that provide additional information that will be merged with a separate
 * run.
 *
 * Key/value pairs that provide additional information about the edge.
 *
 * Key/value pairs that provide additional information about the node.
 *
 * Key/value pairs that provide additional information about the graph.
 *
 * Key/value pairs that provide additional information about the external properties.
 *
 * Key/value pairs that provide additional information about the attachment.
 *
 * Key/value pairs that provide additional information about the rectangle.
 *
 * Key/value pairs that provide additional information about the code flow.
 *
 * Key/value pairs that provide additional information about the threadflow location.
 *
 * Key/value pairs that provide additional information about the request.
 *
 * Key/value pairs that provide additional information about the response.
 *
 * Key/value pairs that provide additional information about the thread flow.
 *
 * Key/value pairs that provide additional information about the change.
 *
 * Key/value pairs that provide additional information about the replacement.
 *
 * Key/value pairs that provide additional information about the fix.
 *
 * Key/value pairs that provide additional information about the edge traversal.
 *
 * Key/value pairs that provide additional information about the graph traversal.
 *
 * Key/value pairs that provide additional information about the result.
 *
 * Key/value pairs that provide additional information about the suppression.
 *
 * Key/value pairs that provide additional information about the log file.
 *
 * Key/value pairs that provide additional information about the run automation details.
 *
 * Key/value pairs that provide additional information about the external property file.
 *
 * Key/value pairs that provide additional information about the external property files.
 *
 * Key/value pairs that provide additional information about the run.
 *
 * Key/value pairs that provide additional information about the special locations.
 *
 * Key/value pairs that provide additional information about the version control details.
 */
export interface PropertyBag {
	/**
	 * A set of distinct strings that provide additional information.
	 */
	tags?: string[];
	[property: string]: any;
}

/**
 * A single artifact. In some cases, this artifact might be nested within another artifact.
 */
export interface Artifact {
	/**
	 * The contents of the artifact.
	 */
	contents?: ArtifactContent;
	/**
	 * A short description of the artifact.
	 */
	description?: Message;
	/**
	 * Specifies the encoding for an artifact object that refers to a text file.
	 */
	encoding?: string;
	/**
	 * A dictionary, each of whose keys is the name of a hash function and each of whose values
	 * is the hashed value of the artifact produced by the specified hash function.
	 */
	hashes?: { [key: string]: string };
	/**
	 * The Coordinated Universal Time (UTC) date and time at which the artifact was most
	 * recently modified. See "Date/time properties" in the SARIF spec for the required format.
	 */
	lastModifiedTimeUtc?: Date;
	/**
	 * The length of the artifact in bytes.
	 */
	length?: number;
	/**
	 * The location of the artifact.
	 */
	location?: ArtifactLocation;
	/**
	 * The MIME type (RFC 2045) of the artifact.
	 */
	mimeType?: string;
	/**
	 * The offset in bytes of the artifact within its containing artifact.
	 */
	offset?: number;
	/**
	 * Identifies the index of the immediate parent of the artifact, if this artifact is nested.
	 */
	parentIndex?: number;
	/**
	 * Key/value pairs that provide additional information about the artifact.
	 */
	properties?: PropertyBag;
	/**
	 * The role or roles played by the artifact in the analysis.
	 */
	roles?: Role[];
	/**
	 * Specifies the source language for any artifact object that refers to a text file that
	 * contains source code.
	 */
	sourceLanguage?: string;
}

/**
 * The contents of the artifact.
 *
 * Represents the contents of an artifact.
 *
 * The portion of the artifact contents within the specified region.
 *
 * The body of the request.
 *
 * The body of the response.
 *
 * The content to insert at the location specified by the 'deletedRegion' property.
 */
export interface ArtifactContent {
	/**
	 * MIME Base64-encoded content from a binary artifact, or from a text artifact in its
	 * original encoding.
	 */
	binary?: string;
	/**
	 * Key/value pairs that provide additional information about the artifact content.
	 */
	properties?: PropertyBag;
	/**
	 * An alternate rendered representation of the artifact (e.g., a decompiled representation
	 * of a binary region).
	 */
	rendered?: MultiformatMessageString;
	/**
	 * UTF-8-encoded content from a text artifact.
	 */
	text?: string;
}

/**
 * An alternate rendered representation of the artifact (e.g., a decompiled representation
 * of a binary region).
 *
 * A message string or message format string rendered in multiple formats.
 *
 * A comprehensive description of the tool component.
 *
 * A description of the report. Should, as far as possible, provide details sufficient to
 * enable resolution of any problem indicated by the result.
 *
 * Provides the primary documentation for the report, useful when there is no online
 * documentation.
 *
 * A concise description of the report. Should be a single sentence that is understandable
 * when visible space is limited to a single line of text.
 *
 * A brief description of the tool component.
 *
 * A comprehensive description of the translation metadata.
 *
 * A brief description of the translation metadata.
 */
export interface MultiformatMessageString {
	/**
	 * A Markdown message string or format string.
	 */
	markdown?: string;
	/**
	 * Key/value pairs that provide additional information about the message.
	 */
	properties?: PropertyBag;
	/**
	 * A plain text message string or format string.
	 */
	text: string;
}

/**
 * A short description of the artifact.
 *
 * A short description of the artifact location.
 *
 * A message relevant to the region.
 *
 * A message relevant to the location.
 *
 * A description of the location relationship.
 *
 * A message relevant to this call stack.
 *
 * A message that describes the condition that was encountered.
 *
 * A description of the reporting descriptor relationship.
 *
 * A description of the graph.
 *
 * A short description of the edge.
 *
 * A short description of the node.
 *
 * A message describing the role played by the attachment.
 *
 * A message relevant to the rectangle.
 *
 * A message relevant to the code flow.
 *
 * A message relevant to the thread flow.
 *
 * A message that describes the proposed fix, enabling viewers to present the proposed
 * change to an end user.
 *
 * A description of this graph traversal.
 *
 * A message to display to the user as the edge is traversed.
 *
 * A message that describes the result. The first sentence of the message only will be
 * displayed when visible space is limited.
 *
 * A description of the identity and role played within the engineering system by this
 * object's containing run object.
 *
 * Encapsulates a message intended to be read by the end user.
 */
export interface Message {
	/**
	 * An array of strings to substitute into the message string.
	 */
	arguments?: string[];
	/**
	 * The identifier for this message.
	 */
	id?: string;
	/**
	 * A Markdown message string.
	 */
	markdown?: string;
	/**
	 * Key/value pairs that provide additional information about the message.
	 */
	properties?: PropertyBag;
	/**
	 * A plain text message string.
	 */
	text?: string;
}

/**
 * The location of the artifact.
 *
 * Specifies the location of an artifact.
 *
 * An absolute URI specifying the location of the executable that was invoked.
 *
 * A file containing the standard error stream from the process that was invoked.
 *
 * A file containing the standard input stream to the process that was invoked.
 *
 * A file containing the standard output stream from the process that was invoked.
 *
 * A file containing the interleaved standard output and standard error stream from the
 * process that was invoked.
 *
 * The working directory for the invocation.
 *
 * Identifies the artifact that the analysis tool was instructed to scan. This need not be
 * the same as the artifact where the result actually occurred.
 *
 * The location of the attachment.
 *
 * The location of the artifact to change.
 *
 * The location of the external property file.
 *
 * Provides a suggestion to SARIF consumers to display file paths relative to the specified
 * location.
 *
 * The location in the local file system to which the root of the repository was mapped at
 * the time of the analysis.
 */
export interface ArtifactLocation {
	/**
	 * A short description of the artifact location.
	 */
	description?: Message;
	/**
	 * The index within the run artifacts array of the artifact object associated with the
	 * artifact location.
	 */
	index?: number;
	/**
	 * Key/value pairs that provide additional information about the artifact location.
	 */
	properties?: PropertyBag;
	/**
	 * A string containing a valid relative or absolute URI.
	 */
	uri?: string;
	/**
	 * A string which indirectly specifies the absolute URI with respect to which a relative URI
	 * in the "uri" property is interpreted.
	 */
	uriBaseId?: string;
}

export enum Role {
	Added = "added",
	AnalysisTarget = "analysisTarget",
	Attachment = "attachment",
	DebugOutputFile = "debugOutputFile",
	Deleted = "deleted",
	Directory = "directory",
	Driver = "driver",
	Extension = "extension",
	MemoryContents = "memoryContents",
	Modified = "modified",
	Policy = "policy",
	ReferencedOnCommandLine = "referencedOnCommandLine",
	Renamed = "renamed",
	ResponseFile = "responseFile",
	ResultFile = "resultFile",
	StandardStream = "standardStream",
	Taxonomy = "taxonomy",
	ToolSpecifiedConfiguration = "toolSpecifiedConfiguration",
	TracedFile = "tracedFile",
	Translation = "translation",
	Uncontrolled = "uncontrolled",
	Unmodified = "unmodified",
	UserSpecifiedConfiguration = "userSpecifiedConfiguration",
}

/**
 * A conversion object that will be merged with a separate run.
 *
 * Describes how a converter transformed the output of a static analysis tool from the
 * analysis tool's native output format into the SARIF format.
 *
 * A conversion object that describes how a converter transformed an analysis tool's native
 * reporting format into the SARIF format.
 */
export interface Conversion {
	/**
	 * The locations of the analysis tool's per-run log files.
	 */
	analysisToolLogFiles?: ArtifactLocation[];
	/**
	 * An invocation object that describes the invocation of the converter.
	 */
	invocation?: Invocation;
	/**
	 * Key/value pairs that provide additional information about the conversion.
	 */
	properties?: PropertyBag;
	/**
	 * A tool object that describes the converter.
	 */
	tool: Tool;
}

/**
 * An invocation object that describes the invocation of the converter.
 *
 * The runtime environment of the analysis tool run.
 */
export interface Invocation {
	/**
	 * The account under which the invocation occurred.
	 */
	account?: string;
	/**
	 * An array of strings, containing in order the command line arguments passed to the tool
	 * from the operating system.
	 */
	arguments?: string[];
	/**
	 * The command line used to invoke the tool.
	 */
	commandLine?: string;
	/**
	 * The Coordinated Universal Time (UTC) date and time at which the invocation ended. See
	 * "Date/time properties" in the SARIF spec for the required format.
	 */
	endTimeUtc?: Date;
	/**
	 * The environment variables associated with the analysis tool process, expressed as
	 * key/value pairs.
	 */
	environmentVariables?: { [key: string]: string };
	/**
	 * An absolute URI specifying the location of the executable that was invoked.
	 */
	executableLocation?: ArtifactLocation;
	/**
	 * Specifies whether the tool's execution completed successfully.
	 */
	executionSuccessful: boolean;
	/**
	 * The process exit code.
	 */
	exitCode?: number;
	/**
	 * The reason for the process exit.
	 */
	exitCodeDescription?: string;
	/**
	 * The name of the signal that caused the process to exit.
	 */
	exitSignalName?: string;
	/**
	 * The numeric value of the signal that caused the process to exit.
	 */
	exitSignalNumber?: number;
	/**
	 * The machine on which the invocation occurred.
	 */
	machine?: string;
	/**
	 * An array of configurationOverride objects that describe notifications related runtime
	 * overrides.
	 */
	notificationConfigurationOverrides?: ConfigurationOverride[];
	/**
	 * The id of the process in which the invocation occurred.
	 */
	processId?: number;
	/**
	 * The reason given by the operating system that the process failed to start.
	 */
	processStartFailureMessage?: string;
	/**
	 * Key/value pairs that provide additional information about the invocation.
	 */
	properties?: PropertyBag;
	/**
	 * The locations of any response files specified on the tool's command line.
	 */
	responseFiles?: ArtifactLocation[];
	/**
	 * An array of configurationOverride objects that describe rules related runtime overrides.
	 */
	ruleConfigurationOverrides?: ConfigurationOverride[];
	/**
	 * The Coordinated Universal Time (UTC) date and time at which the invocation started. See
	 * "Date/time properties" in the SARIF spec for the required format.
	 */
	startTimeUtc?: Date;
	/**
	 * A file containing the standard error stream from the process that was invoked.
	 */
	stderr?: ArtifactLocation;
	/**
	 * A file containing the standard input stream to the process that was invoked.
	 */
	stdin?: ArtifactLocation;
	/**
	 * A file containing the standard output stream from the process that was invoked.
	 */
	stdout?: ArtifactLocation;
	/**
	 * A file containing the interleaved standard output and standard error stream from the
	 * process that was invoked.
	 */
	stdoutStderr?: ArtifactLocation;
	/**
	 * A list of conditions detected by the tool that are relevant to the tool's configuration.
	 */
	toolConfigurationNotifications?: Notification[];
	/**
	 * A list of runtime conditions detected by the tool during the analysis.
	 */
	toolExecutionNotifications?: Notification[];
	/**
	 * The working directory for the invocation.
	 */
	workingDirectory?: ArtifactLocation;
}

/**
 * Information about how a specific rule or notification was reconfigured at runtime.
 */
export interface ConfigurationOverride {
	/**
	 * Specifies how the rule or notification was configured during the scan.
	 */
	configuration: ReportingConfiguration;
	/**
	 * A reference used to locate the descriptor whose configuration was overridden.
	 */
	descriptor: ReportingDescriptorReference;
	/**
	 * Key/value pairs that provide additional information about the configuration override.
	 */
	properties?: PropertyBag;
}

/**
 * Specifies how the rule or notification was configured during the scan.
 *
 * Information about a rule or notification that can be configured at runtime.
 *
 * Default reporting configuration information.
 */
export interface ReportingConfiguration {
	/**
	 * Specifies whether the report may be produced during the scan.
	 */
	enabled?: boolean;
	/**
	 * Specifies the failure level for the report.
	 */
	level?: Level;
	/**
	 * Contains configuration information specific to a report.
	 */
	parameters?: PropertyBag;
	/**
	 * Key/value pairs that provide additional information about the reporting configuration.
	 */
	properties?: PropertyBag;
	/**
	 * Specifies the relative priority of the report. Used for analysis output only.
	 */
	rank?: number;
}

/**
 * Specifies the failure level for the report.
 *
 * A value specifying the severity level of the notification.
 *
 * A value specifying the severity level of the result.
 */
export enum Level {
	Error = "error",
	None = "none",
	Note = "note",
	Warning = "warning",
}

/**
 * A reference used to locate the descriptor whose configuration was overridden.
 *
 * A reference used to locate the rule descriptor associated with this notification.
 *
 * A reference used to locate the descriptor relevant to this notification.
 *
 * A reference to the related reporting descriptor.
 *
 * A reference used to locate the rule descriptor relevant to this result.
 *
 * Information about how to locate a relevant reporting descriptor.
 */
export interface ReportingDescriptorReference {
	/**
	 * A guid that uniquely identifies the descriptor.
	 */
	guid?: string;
	/**
	 * The id of the descriptor.
	 */
	id?: string;
	/**
	 * The index into an array of descriptors in toolComponent.ruleDescriptors,
	 * toolComponent.notificationDescriptors, or toolComponent.taxonomyDescriptors, depending on
	 * context.
	 */
	index?: number;
	/**
	 * Key/value pairs that provide additional information about the reporting descriptor
	 * reference.
	 */
	properties?: PropertyBag;
	/**
	 * A reference used to locate the toolComponent associated with the descriptor.
	 */
	toolComponent?: ToolComponentReference;
}

/**
 * A reference used to locate the toolComponent associated with the descriptor.
 *
 * Identifies a particular toolComponent object, either the driver or an extension.
 *
 * The component which is strongly associated with this component. For a translation, this
 * refers to the component which has been translated. For an extension, this is the driver
 * that provides the extension's plugin model.
 */
export interface ToolComponentReference {
	/**
	 * The 'guid' property of the referenced toolComponent.
	 */
	guid?: string;
	/**
	 * An index into the referenced toolComponent in tool.extensions.
	 */
	index?: number;
	/**
	 * The 'name' property of the referenced toolComponent.
	 */
	name?: string;
	/**
	 * Key/value pairs that provide additional information about the toolComponentReference.
	 */
	properties?: PropertyBag;
}

/**
 * Describes a condition relevant to the tool itself, as opposed to being relevant to a
 * target being analyzed by the tool.
 */
export interface Notification {
	/**
	 * A reference used to locate the rule descriptor associated with this notification.
	 */
	associatedRule?: ReportingDescriptorReference;
	/**
	 * A reference used to locate the descriptor relevant to this notification.
	 */
	descriptor?: ReportingDescriptorReference;
	/**
	 * The runtime exception, if any, relevant to this notification.
	 */
	exception?: Exception;
	/**
	 * A value specifying the severity level of the notification.
	 */
	level?: Level;
	/**
	 * The locations relevant to this notification.
	 */
	locations?: Location[];
	/**
	 * A message that describes the condition that was encountered.
	 */
	message: Message;
	/**
	 * Key/value pairs that provide additional information about the notification.
	 */
	properties?: PropertyBag;
	/**
	 * The thread identifier of the code that generated the notification.
	 */
	threadId?: number;
	/**
	 * The Coordinated Universal Time (UTC) date and time at which the analysis tool generated
	 * the notification.
	 */
	timeUtc?: Date;
}

/**
 * The runtime exception, if any, relevant to this notification.
 *
 * Describes a runtime exception encountered during the execution of an analysis tool.
 */
export interface Exception {
	/**
	 * An array of exception objects each of which is considered a cause of this exception.
	 */
	innerExceptions?: Exception[];
	/**
	 * A string that identifies the kind of exception, for example, the fully qualified type
	 * name of an object that was thrown, or the symbolic name of a signal.
	 */
	kind?: string;
	/**
	 * A message that describes the exception.
	 */
	message?: string;
	/**
	 * Key/value pairs that provide additional information about the exception.
	 */
	properties?: PropertyBag;
	/**
	 * The sequence of function calls leading to the exception.
	 */
	stack?: Stack;
}

/**
 * The sequence of function calls leading to the exception.
 *
 * A call stack that is relevant to a result.
 *
 * The call stack leading to this location.
 */
export interface Stack {
	/**
	 * An array of stack frames that represents a sequence of calls, rendered in reverse
	 * chronological order, that comprise the call stack.
	 */
	frames: StackFrame[];
	/**
	 * A message relevant to this call stack.
	 */
	message?: Message;
	/**
	 * Key/value pairs that provide additional information about the stack.
	 */
	properties?: PropertyBag;
}

/**
 * A function call within a stack trace.
 */
export interface StackFrame {
	/**
	 * The location to which this stack frame refers.
	 */
	location?: Location;
	/**
	 * The name of the module that contains the code of this stack frame.
	 */
	module?: string;
	/**
	 * The parameters of the call that is executing.
	 */
	parameters?: string[];
	/**
	 * Key/value pairs that provide additional information about the stack frame.
	 */
	properties?: PropertyBag;
	/**
	 * The thread identifier of the stack frame.
	 */
	threadId?: number;
}

/**
 * The location to which this stack frame refers.
 *
 * A location within a programming artifact.
 *
 * A code location associated with the node.
 *
 * The code location.
 *
 * Identifies the location associated with the suppression.
 */
export interface Location {
	/**
	 * A set of regions relevant to the location.
	 */
	annotations?: Region[];
	/**
	 * Value that distinguishes this location from all other locations within a single result
	 * object.
	 */
	id?: number;
	/**
	 * The logical locations associated with the result.
	 */
	logicalLocations?: LogicalLocation[];
	/**
	 * A message relevant to the location.
	 */
	message?: Message;
	/**
	 * Identifies the artifact and region.
	 */
	physicalLocation?: PhysicalLocation;
	/**
	 * Key/value pairs that provide additional information about the location.
	 */
	properties?: PropertyBag;
	/**
	 * An array of objects that describe relationships between this location and others.
	 */
	relationships?: LocationRelationship[];
}

/**
 * A region within an artifact where a result was detected.
 *
 * Specifies a portion of the artifact that encloses the region. Allows a viewer to display
 * additional context around the region.
 *
 * Specifies a portion of the artifact.
 *
 * The region of the artifact to delete.
 */
export interface Region {
	/**
	 * The length of the region in bytes.
	 */
	byteLength?: number;
	/**
	 * The zero-based offset from the beginning of the artifact of the first byte in the region.
	 */
	byteOffset?: number;
	/**
	 * The length of the region in characters.
	 */
	charLength?: number;
	/**
	 * The zero-based offset from the beginning of the artifact of the first character in the
	 * region.
	 */
	charOffset?: number;
	/**
	 * The column number of the character following the end of the region.
	 */
	endColumn?: number;
	/**
	 * The line number of the last character in the region.
	 */
	endLine?: number;
	/**
	 * A message relevant to the region.
	 */
	message?: Message;
	/**
	 * Key/value pairs that provide additional information about the region.
	 */
	properties?: PropertyBag;
	/**
	 * The portion of the artifact contents within the specified region.
	 */
	snippet?: ArtifactContent;
	/**
	 * Specifies the source language, if any, of the portion of the artifact specified by the
	 * region object.
	 */
	sourceLanguage?: string;
	/**
	 * The column number of the first character in the region.
	 */
	startColumn?: number;
	/**
	 * The line number of the first character in the region.
	 */
	startLine?: number;
}

/**
 * A logical location of a construct that produced a result.
 */
export interface LogicalLocation {
	/**
	 * The machine-readable name for the logical location, such as a mangled function name
	 * provided by a C++ compiler that encodes calling convention, return type and other details
	 * along with the function name.
	 */
	decoratedName?: string;
	/**
	 * The human-readable fully qualified name of the logical location.
	 */
	fullyQualifiedName?: string;
	/**
	 * The index within the logical locations array.
	 */
	index?: number;
	/**
	 * The type of construct this logical location component refers to. Should be one of
	 * 'function', 'member', 'module', 'namespace', 'parameter', 'resource', 'returnType',
	 * 'type', 'variable', 'object', 'array', 'property', 'value', 'element', 'text',
	 * 'attribute', 'comment', 'declaration', 'dtd' or 'processingInstruction', if any of those
	 * accurately describe the construct.
	 */
	kind?: string;
	/**
	 * Identifies the construct in which the result occurred. For example, this property might
	 * contain the name of a class or a method.
	 */
	name?: string;
	/**
	 * Identifies the index of the immediate parent of the construct in which the result was
	 * detected. For example, this property might point to a logical location that represents
	 * the namespace that holds a type.
	 */
	parentIndex?: number;
	/**
	 * Key/value pairs that provide additional information about the logical location.
	 */
	properties?: PropertyBag;
}

/**
 * Identifies the artifact and region.
 *
 * A physical location relevant to a result. Specifies a reference to a programming artifact
 * together with a range of bytes or characters within that artifact.
 */
export interface PhysicalLocation {
	/**
	 * The address of the location.
	 */
	address?: Address;
	/**
	 * The location of the artifact.
	 */
	artifactLocation?: ArtifactLocation;
	/**
	 * Specifies a portion of the artifact that encloses the region. Allows a viewer to display
	 * additional context around the region.
	 */
	contextRegion?: Region;
	/**
	 * Key/value pairs that provide additional information about the physical location.
	 */
	properties?: PropertyBag;
	/**
	 * Specifies a portion of the artifact.
	 */
	region?: Region;
}

/**
 * Information about the relation of one location to another.
 */
export interface LocationRelationship {
	/**
	 * A description of the location relationship.
	 */
	description?: Message;
	/**
	 * A set of distinct strings that categorize the relationship. Well-known kinds include
	 * 'includes', 'isIncludedBy' and 'relevant'.
	 */
	kinds?: string[];
	/**
	 * Key/value pairs that provide additional information about the location relationship.
	 */
	properties?: PropertyBag;
	/**
	 * A reference to the related location.
	 */
	target: number;
}

/**
 * A tool object that describes the converter.
 *
 * The analysis tool that was run.
 *
 * Information about the tool or tool pipeline that generated the results in this run. A run
 * can only contain results produced by a single tool or tool pipeline. A run can aggregate
 * results from multiple log files, as long as context around the tool run (tool
 * command-line arguments and the like) is identical for all aggregated files.
 */
export interface Tool {
	/**
	 * The analysis tool that was run.
	 */
	driver: ToolComponent;
	/**
	 * Tool extensions that contributed to or reconfigured the analysis tool that was run.
	 */
	extensions?: ToolComponent[];
	/**
	 * Key/value pairs that provide additional information about the tool.
	 */
	properties?: PropertyBag;
}

/**
 * The analysis tool that was run.
 *
 * A component, such as a plug-in or the driver, of the analysis tool that was run.
 *
 * The analysis tool object that will be merged with a separate run.
 */
export interface ToolComponent {
	/**
	 * The component which is strongly associated with this component. For a translation, this
	 * refers to the component which has been translated. For an extension, this is the driver
	 * that provides the extension's plugin model.
	 */
	associatedComponent?: ToolComponentReference;
	/**
	 * The kinds of data contained in this object.
	 */
	contents?: Content[];
	/**
	 * The binary version of the tool component's primary executable file expressed as four
	 * non-negative integers separated by a period (for operating systems that express file
	 * versions in this way).
	 */
	dottedQuadFileVersion?: string;
	/**
	 * The absolute URI from which the tool component can be downloaded.
	 */
	downloadUri?: string;
	/**
	 * A comprehensive description of the tool component.
	 */
	fullDescription?: MultiformatMessageString;
	/**
	 * The name of the tool component along with its version and any other useful identifying
	 * information, such as its locale.
	 */
	fullName?: string;
	/**
	 * A dictionary, each of whose keys is a resource identifier and each of whose values is a
	 * multiformatMessageString object, which holds message strings in plain text and
	 * (optionally) Markdown format. The strings can include placeholders, which can be used to
	 * construct a message in combination with an arbitrary number of additional string
	 * arguments.
	 */
	globalMessageStrings?: { [key: string]: MultiformatMessageString };
	/**
	 * A unique identifier for the tool component in the form of a GUID.
	 */
	guid?: string;
	/**
	 * The absolute URI at which information about this version of the tool component can be
	 * found.
	 */
	informationUri?: string;
	/**
	 * Specifies whether this object contains a complete definition of the localizable and/or
	 * non-localizable data for this component, as opposed to including only data that is
	 * relevant to the results persisted to this log file.
	 */
	isComprehensive?: boolean;
	/**
	 * The language of the messages emitted into the log file during this run (expressed as an
	 * ISO 639-1 two-letter lowercase language code) and an optional region (expressed as an ISO
	 * 3166-1 two-letter uppercase subculture code associated with a country or region). The
	 * casing is recommended but not required (in order for this data to conform to RFC5646).
	 */
	language?: string;
	/**
	 * The semantic version of the localized strings defined in this component; maintained by
	 * components that provide translations.
	 */
	localizedDataSemanticVersion?: string;
	/**
	 * An array of the artifactLocation objects associated with the tool component.
	 */
	locations?: ArtifactLocation[];
	/**
	 * The minimum value of localizedDataSemanticVersion required in translations consumed by
	 * this component; used by components that consume translations.
	 */
	minimumRequiredLocalizedDataSemanticVersion?: string;
	/**
	 * The name of the tool component.
	 */
	name: string;
	/**
	 * An array of reportingDescriptor objects relevant to the notifications related to the
	 * configuration and runtime execution of the tool component.
	 */
	notifications?: ReportingDescriptor[];
	/**
	 * The organization or company that produced the tool component.
	 */
	organization?: string;
	/**
	 * A product suite to which the tool component belongs.
	 */
	product?: string;
	/**
	 * A localizable string containing the name of the suite of products to which the tool
	 * component belongs.
	 */
	productSuite?: string;
	/**
	 * Key/value pairs that provide additional information about the tool component.
	 */
	properties?: PropertyBag;
	/**
	 * A string specifying the UTC date (and optionally, the time) of the component's release.
	 */
	releaseDateUtc?: string;
	/**
	 * An array of reportingDescriptor objects relevant to the analysis performed by the tool
	 * component.
	 */
	rules?: ReportingDescriptor[];
	/**
	 * The tool component version in the format specified by Semantic Versioning 2.0.
	 */
	semanticVersion?: string;
	/**
	 * A brief description of the tool component.
	 */
	shortDescription?: MultiformatMessageString;
	/**
	 * An array of toolComponentReference objects to declare the taxonomies supported by the
	 * tool component.
	 */
	supportedTaxonomies?: ToolComponentReference[];
	/**
	 * An array of reportingDescriptor objects relevant to the definitions of both standalone
	 * and tool-defined taxonomies.
	 */
	taxa?: ReportingDescriptor[];
	/**
	 * Translation metadata, required for a translation, not populated by other component types.
	 */
	translationMetadata?: TranslationMetadata;
	/**
	 * The tool component version, in whatever format the component natively provides.
	 */
	version?: string;
}

export enum Content {
	LocalizedData = "localizedData",
	NonLocalizedData = "nonLocalizedData",
}

/**
 * Metadata that describes a specific report produced by the tool, as part of the analysis
 * it provides or its runtime reporting.
 */
export interface ReportingDescriptor {
	/**
	 * Default reporting configuration information.
	 */
	defaultConfiguration?: ReportingConfiguration;
	/**
	 * An array of unique identifies in the form of a GUID by which this report was known in
	 * some previous version of the analysis tool.
	 */
	deprecatedGuids?: string[];
	/**
	 * An array of stable, opaque identifiers by which this report was known in some previous
	 * version of the analysis tool.
	 */
	deprecatedIds?: string[];
	/**
	 * An array of readable identifiers by which this report was known in some previous version
	 * of the analysis tool.
	 */
	deprecatedNames?: string[];
	/**
	 * A description of the report. Should, as far as possible, provide details sufficient to
	 * enable resolution of any problem indicated by the result.
	 */
	fullDescription?: MultiformatMessageString;
	/**
	 * A unique identifier for the reporting descriptor in the form of a GUID.
	 */
	guid?: string;
	/**
	 * Provides the primary documentation for the report, useful when there is no online
	 * documentation.
	 */
	help?: MultiformatMessageString;
	/**
	 * A URI where the primary documentation for the report can be found.
	 */
	helpUri?: string;
	/**
	 * A stable, opaque identifier for the report.
	 */
	id: string;
	/**
	 * A set of name/value pairs with arbitrary names. Each value is a multiformatMessageString
	 * object, which holds message strings in plain text and (optionally) Markdown format. The
	 * strings can include placeholders, which can be used to construct a message in combination
	 * with an arbitrary number of additional string arguments.
	 */
	messageStrings?: { [key: string]: MultiformatMessageString };
	/**
	 * A report identifier that is understandable to an end user.
	 */
	name?: string;
	/**
	 * Key/value pairs that provide additional information about the report.
	 */
	properties?: PropertyBag;
	/**
	 * An array of objects that describe relationships between this reporting descriptor and
	 * others.
	 */
	relationships?: ReportingDescriptorRelationship[];
	/**
	 * A concise description of the report. Should be a single sentence that is understandable
	 * when visible space is limited to a single line of text.
	 */
	shortDescription?: MultiformatMessageString;
}

/**
 * Information about the relation of one reporting descriptor to another.
 */
export interface ReportingDescriptorRelationship {
	/**
	 * A description of the reporting descriptor relationship.
	 */
	description?: Message;
	/**
	 * A set of distinct strings that categorize the relationship. Well-known kinds include
	 * 'canPrecede', 'canFollow', 'willPrecede', 'willFollow', 'superset', 'subset', 'equal',
	 * 'disjoint', 'relevant', and 'incomparable'.
	 */
	kinds?: string[];
	/**
	 * Key/value pairs that provide additional information about the reporting descriptor
	 * reference.
	 */
	properties?: PropertyBag;
	/**
	 * A reference to the related reporting descriptor.
	 */
	target: ReportingDescriptorReference;
}

/**
 * Translation metadata, required for a translation, not populated by other component
 * types.
 *
 * Provides additional metadata related to translation.
 */
export interface TranslationMetadata {
	/**
	 * The absolute URI from which the translation metadata can be downloaded.
	 */
	downloadUri?: string;
	/**
	 * A comprehensive description of the translation metadata.
	 */
	fullDescription?: MultiformatMessageString;
	/**
	 * The full name associated with the translation metadata.
	 */
	fullName?: string;
	/**
	 * The absolute URI from which information related to the translation metadata can be
	 * downloaded.
	 */
	informationUri?: string;
	/**
	 * The name associated with the translation metadata.
	 */
	name: string;
	/**
	 * Key/value pairs that provide additional information about the translation metadata.
	 */
	properties?: PropertyBag;
	/**
	 * A brief description of the translation metadata.
	 */
	shortDescription?: MultiformatMessageString;
}

/**
 * A network of nodes and directed edges that describes some aspect of the structure of the
 * code (for example, a call graph).
 */
export interface Graph {
	/**
	 * A description of the graph.
	 */
	description?: Message;
	/**
	 * An array of edge objects representing the edges of the graph.
	 */
	edges?: Edge[];
	/**
	 * An array of node objects representing the nodes of the graph.
	 */
	nodes?: Node[];
	/**
	 * Key/value pairs that provide additional information about the graph.
	 */
	properties?: PropertyBag;
}

/**
 * Represents a directed edge in a graph.
 */
export interface Edge {
	/**
	 * A string that uniquely identifies the edge within its graph.
	 */
	id: string;
	/**
	 * A short description of the edge.
	 */
	label?: Message;
	/**
	 * Key/value pairs that provide additional information about the edge.
	 */
	properties?: PropertyBag;
	/**
	 * Identifies the source node (the node at which the edge starts).
	 */
	sourceNodeId: string;
	/**
	 * Identifies the target node (the node at which the edge ends).
	 */
	targetNodeId: string;
}

/**
 * Represents a node in a graph.
 */
export interface Node {
	/**
	 * Array of child nodes.
	 */
	children?: Node[];
	/**
	 * A string that uniquely identifies the node within its graph.
	 */
	id: string;
	/**
	 * A short description of the node.
	 */
	label?: Message;
	/**
	 * A code location associated with the node.
	 */
	location?: Location;
	/**
	 * Key/value pairs that provide additional information about the node.
	 */
	properties?: PropertyBag;
}

/**
 * A result produced by an analysis tool.
 */
export interface Result {
	/**
	 * Identifies the artifact that the analysis tool was instructed to scan. This need not be
	 * the same as the artifact where the result actually occurred.
	 */
	analysisTarget?: ArtifactLocation;
	/**
	 * A set of artifacts relevant to the result.
	 */
	attachments?: Attachment[];
	/**
	 * The state of a result relative to a baseline of a previous run.
	 */
	baselineState?: BaselineState;
	/**
	 * An array of 'codeFlow' objects relevant to the result.
	 */
	codeFlows?: CodeFlow[];
	/**
	 * A stable, unique identifier for the equivalence class of logically identical results to
	 * which this result belongs, in the form of a GUID.
	 */
	correlationGuid?: string;
	/**
	 * A set of strings each of which individually defines a stable, unique identity for the
	 * result.
	 */
	fingerprints?: { [key: string]: string };
	/**
	 * An array of 'fix' objects, each of which represents a proposed fix to the problem
	 * indicated by the result.
	 */
	fixes?: Fix[];
	/**
	 * An array of zero or more unique graph objects associated with the result.
	 */
	graphs?: Graph[];
	/**
	 * An array of one or more unique 'graphTraversal' objects.
	 */
	graphTraversals?: GraphTraversal[];
	/**
	 * A stable, unique identifier for the result in the form of a GUID.
	 */
	guid?: string;
	/**
	 * An absolute URI at which the result can be viewed.
	 */
	hostedViewerUri?: string;
	/**
	 * A value that categorizes results by evaluation state.
	 */
	kind?: ResultKind;
	/**
	 * A value specifying the severity level of the result.
	 */
	level?: Level;
	/**
	 * The set of locations where the result was detected. Specify only one location unless the
	 * problem indicated by the result can only be corrected by making a change at every
	 * specified location.
	 */
	locations?: Location[];
	/**
	 * A message that describes the result. The first sentence of the message only will be
	 * displayed when visible space is limited.
	 */
	message: Message;
	/**
	 * A positive integer specifying the number of times this logically unique result was
	 * observed in this run.
	 */
	occurrenceCount?: number;
	/**
	 * A set of strings that contribute to the stable, unique identity of the result.
	 */
	partialFingerprints?: { [key: string]: string };
	/**
	 * Key/value pairs that provide additional information about the result.
	 */
	properties?: PropertyBag;
	/**
	 * Information about how and when the result was detected.
	 */
	provenance?: ResultProvenance;
	/**
	 * A number representing the priority or importance of the result.
	 */
	rank?: number;
	/**
	 * A set of locations relevant to this result.
	 */
	relatedLocations?: Location[];
	/**
	 * A reference used to locate the rule descriptor relevant to this result.
	 */
	rule?: ReportingDescriptorReference;
	/**
	 * The stable, unique identifier of the rule, if any, to which this result is relevant.
	 */
	ruleId?: string;
	/**
	 * The index within the tool component rules array of the rule object associated with this
	 * result.
	 */
	ruleIndex?: number;
	/**
	 * An array of 'stack' objects relevant to the result.
	 */
	stacks?: Stack[];
	/**
	 * A set of suppressions relevant to this result.
	 */
	suppressions?: Suppression[];
	/**
	 * An array of references to taxonomy reporting descriptors that are applicable to the
	 * result.
	 */
	taxa?: ReportingDescriptorReference[];
	/**
	 * A web request associated with this result.
	 */
	webRequest?: WebRequest;
	/**
	 * A web response associated with this result.
	 */
	webResponse?: WebResponse;
	/**
	 * The URIs of the work items associated with this result.
	 */
	workItemUris?: string[];
}

/**
 * An artifact relevant to a result.
 */
export interface Attachment {
	/**
	 * The location of the attachment.
	 */
	artifactLocation: ArtifactLocation;
	/**
	 * A message describing the role played by the attachment.
	 */
	description?: Message;
	/**
	 * Key/value pairs that provide additional information about the attachment.
	 */
	properties?: PropertyBag;
	/**
	 * An array of rectangles specifying areas of interest within the image.
	 */
	rectangles?: Rectangle[];
	/**
	 * An array of regions of interest within the attachment.
	 */
	regions?: Region[];
}

/**
 * An area within an image.
 */
export interface Rectangle {
	/**
	 * The Y coordinate of the bottom edge of the rectangle, measured in the image's natural
	 * units.
	 */
	bottom?: number;
	/**
	 * The X coordinate of the left edge of the rectangle, measured in the image's natural units.
	 */
	left?: number;
	/**
	 * A message relevant to the rectangle.
	 */
	message?: Message;
	/**
	 * Key/value pairs that provide additional information about the rectangle.
	 */
	properties?: PropertyBag;
	/**
	 * The X coordinate of the right edge of the rectangle, measured in the image's natural
	 * units.
	 */
	right?: number;
	/**
	 * The Y coordinate of the top edge of the rectangle, measured in the image's natural units.
	 */
	top?: number;
}

/**
 * The state of a result relative to a baseline of a previous run.
 */
export enum BaselineState {
	Absent = "absent",
	New = "new",
	Unchanged = "unchanged",
	Updated = "updated",
}

/**
 * A set of threadFlows which together describe a pattern of code execution relevant to
 * detecting a result.
 */
export interface CodeFlow {
	/**
	 * A message relevant to the code flow.
	 */
	message?: Message;
	/**
	 * Key/value pairs that provide additional information about the code flow.
	 */
	properties?: PropertyBag;
	/**
	 * An array of one or more unique threadFlow objects, each of which describes the progress
	 * of a program through a thread of execution.
	 */
	threadFlows: ThreadFlow[];
}

/**
 * Describes a sequence of code locations that specify a path through a single thread of
 * execution such as an operating system or fiber.
 */
export interface ThreadFlow {
	/**
	 * An string that uniquely identifies the threadFlow within the codeFlow in which it occurs.
	 */
	id?: string;
	/**
	 * Values of relevant expressions at the start of the thread flow that remain constant.
	 */
	immutableState?: { [key: string]: MultiformatMessageString };
	/**
	 * Values of relevant expressions at the start of the thread flow that may change during
	 * thread flow execution.
	 */
	initialState?: { [key: string]: MultiformatMessageString };
	/**
	 * A temporally ordered array of 'threadFlowLocation' objects, each of which describes a
	 * location visited by the tool while producing the result.
	 */
	locations: ThreadFlowLocation[];
	/**
	 * A message relevant to the thread flow.
	 */
	message?: Message;
	/**
	 * Key/value pairs that provide additional information about the thread flow.
	 */
	properties?: PropertyBag;
}

/**
 * A location visited by an analysis tool while simulating or monitoring the execution of a
 * program.
 */
export interface ThreadFlowLocation {
	/**
	 * An integer representing the temporal order in which execution reached this location.
	 */
	executionOrder?: number;
	/**
	 * The Coordinated Universal Time (UTC) date and time at which this location was executed.
	 */
	executionTimeUtc?: Date;
	/**
	 * Specifies the importance of this location in understanding the code flow in which it
	 * occurs. The order from most to least important is "essential", "important",
	 * "unimportant". Default: "important".
	 */
	importance?: Importance;
	/**
	 * The index within the run threadFlowLocations array.
	 */
	index?: number;
	/**
	 * A set of distinct strings that categorize the thread flow location. Well-known kinds
	 * include 'acquire', 'release', 'enter', 'exit', 'call', 'return', 'branch', 'implicit',
	 * 'false', 'true', 'caution', 'danger', 'unknown', 'unreachable', 'taint', 'function',
	 * 'handler', 'lock', 'memory', 'resource', 'scope' and 'value'.
	 */
	kinds?: string[];
	/**
	 * The code location.
	 */
	location?: Location;
	/**
	 * The name of the module that contains the code that is executing.
	 */
	module?: string;
	/**
	 * An integer representing a containment hierarchy within the thread flow.
	 */
	nestingLevel?: number;
	/**
	 * Key/value pairs that provide additional information about the threadflow location.
	 */
	properties?: PropertyBag;
	/**
	 * The call stack leading to this location.
	 */
	stack?: Stack;
	/**
	 * A dictionary, each of whose keys specifies a variable or expression, the associated value
	 * of which represents the variable or expression value. For an annotation of kind
	 * 'continuation', for example, this dictionary might hold the current assumed values of a
	 * set of global variables.
	 */
	state?: { [key: string]: MultiformatMessageString };
	/**
	 * An array of references to rule or taxonomy reporting descriptors that are applicable to
	 * the thread flow location.
	 */
	taxa?: ReportingDescriptorReference[];
	/**
	 * A web request associated with this thread flow location.
	 */
	webRequest?: WebRequest;
	/**
	 * A web response associated with this thread flow location.
	 */
	webResponse?: WebResponse;
}

/**
 * Specifies the importance of this location in understanding the code flow in which it
 * occurs. The order from most to least important is "essential", "important",
 * "unimportant". Default: "important".
 */
export enum Importance {
	Essential = "essential",
	Important = "important",
	Unimportant = "unimportant",
}

/**
 * A web request associated with this thread flow location.
 *
 * Describes an HTTP request.
 *
 * A web request associated with this result.
 */
export interface WebRequest {
	/**
	 * The body of the request.
	 */
	body?: ArtifactContent;
	/**
	 * The request headers.
	 */
	headers?: { [key: string]: string };
	/**
	 * The index within the run.webRequests array of the request object associated with this
	 * result.
	 */
	index?: number;
	/**
	 * The HTTP method. Well-known values are 'GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'HEAD',
	 * 'OPTIONS', 'TRACE', 'CONNECT'.
	 */
	method?: string;
	/**
	 * The request parameters.
	 */
	parameters?: { [key: string]: string };
	/**
	 * Key/value pairs that provide additional information about the request.
	 */
	properties?: PropertyBag;
	/**
	 * The request protocol. Example: 'http'.
	 */
	protocol?: string;
	/**
	 * The target of the request.
	 */
	target?: string;
	/**
	 * The request version. Example: '1.1'.
	 */
	version?: string;
}

/**
 * A web response associated with this thread flow location.
 *
 * Describes the response to an HTTP request.
 *
 * A web response associated with this result.
 */
export interface WebResponse {
	/**
	 * The body of the response.
	 */
	body?: ArtifactContent;
	/**
	 * The response headers.
	 */
	headers?: { [key: string]: string };
	/**
	 * The index within the run.webResponses array of the response object associated with this
	 * result.
	 */
	index?: number;
	/**
	 * Specifies whether a response was received from the server.
	 */
	noResponseReceived?: boolean;
	/**
	 * Key/value pairs that provide additional information about the response.
	 */
	properties?: PropertyBag;
	/**
	 * The response protocol. Example: 'http'.
	 */
	protocol?: string;
	/**
	 * The response reason. Example: 'Not found'.
	 */
	reasonPhrase?: string;
	/**
	 * The response status code. Example: 451.
	 */
	statusCode?: number;
	/**
	 * The response version. Example: '1.1'.
	 */
	version?: string;
}

/**
 * A proposed fix for the problem represented by a result object. A fix specifies a set of
 * artifacts to modify. For each artifact, it specifies a set of bytes to remove, and
 * provides a set of new bytes to replace them.
 */
export interface Fix {
	/**
	 * One or more artifact changes that comprise a fix for a result.
	 */
	artifactChanges: ArtifactChange[];
	/**
	 * A message that describes the proposed fix, enabling viewers to present the proposed
	 * change to an end user.
	 */
	description?: Message;
	/**
	 * Key/value pairs that provide additional information about the fix.
	 */
	properties?: PropertyBag;
}

/**
 * A change to a single artifact.
 */
export interface ArtifactChange {
	/**
	 * The location of the artifact to change.
	 */
	artifactLocation: ArtifactLocation;
	/**
	 * Key/value pairs that provide additional information about the change.
	 */
	properties?: PropertyBag;
	/**
	 * An array of replacement objects, each of which represents the replacement of a single
	 * region in a single artifact specified by 'artifactLocation'.
	 */
	replacements: Replacement[];
}

/**
 * The replacement of a single region of an artifact.
 */
export interface Replacement {
	/**
	 * The region of the artifact to delete.
	 */
	deletedRegion: Region;
	/**
	 * The content to insert at the location specified by the 'deletedRegion' property.
	 */
	insertedContent?: ArtifactContent;
	/**
	 * Key/value pairs that provide additional information about the replacement.
	 */
	properties?: PropertyBag;
}

/**
 * Represents a path through a graph.
 */
export interface GraphTraversal {
	/**
	 * A description of this graph traversal.
	 */
	description?: Message;
	/**
	 * The sequences of edges traversed by this graph traversal.
	 */
	edgeTraversals?: EdgeTraversal[];
	/**
	 * Values of relevant expressions at the start of the graph traversal that remain constant
	 * for the graph traversal.
	 */
	immutableState?: { [key: string]: MultiformatMessageString };
	/**
	 * Values of relevant expressions at the start of the graph traversal that may change during
	 * graph traversal.
	 */
	initialState?: { [key: string]: MultiformatMessageString };
	/**
	 * Key/value pairs that provide additional information about the graph traversal.
	 */
	properties?: PropertyBag;
	/**
	 * The index within the result.graphs to be associated with the result.
	 */
	resultGraphIndex?: number;
	/**
	 * The index within the run.graphs to be associated with the result.
	 */
	runGraphIndex?: number;
}

/**
 * Represents the traversal of a single edge during a graph traversal.
 */
export interface EdgeTraversal {
	/**
	 * Identifies the edge being traversed.
	 */
	edgeId: string;
	/**
	 * The values of relevant expressions after the edge has been traversed.
	 */
	finalState?: { [key: string]: MultiformatMessageString };
	/**
	 * A message to display to the user as the edge is traversed.
	 */
	message?: Message;
	/**
	 * Key/value pairs that provide additional information about the edge traversal.
	 */
	properties?: PropertyBag;
	/**
	 * The number of edge traversals necessary to return from a nested graph.
	 */
	stepOverEdgeCount?: number;
}

/**
 * A value that categorizes results by evaluation state.
 */
export enum ResultKind {
	Fail = "fail",
	Informational = "informational",
	NotApplicable = "notApplicable",
	Open = "open",
	Pass = "pass",
	Review = "review",
}

/**
 * Information about how and when the result was detected.
 *
 * Contains information about how and when a result was detected.
 */
export interface ResultProvenance {
	/**
	 * An array of physicalLocation objects which specify the portions of an analysis tool's
	 * output that a converter transformed into the result.
	 */
	conversionSources?: PhysicalLocation[];
	/**
	 * A GUID-valued string equal to the automationDetails.guid property of the run in which the
	 * result was first detected.
	 */
	firstDetectionRunGuid?: string;
	/**
	 * The Coordinated Universal Time (UTC) date and time at which the result was first
	 * detected. See "Date/time properties" in the SARIF spec for the required format.
	 */
	firstDetectionTimeUtc?: Date;
	/**
	 * The index within the run.invocations array of the invocation object which describes the
	 * tool invocation that detected the result.
	 */
	invocationIndex?: number;
	/**
	 * A GUID-valued string equal to the automationDetails.guid property of the run in which the
	 * result was most recently detected.
	 */
	lastDetectionRunGuid?: string;
	/**
	 * The Coordinated Universal Time (UTC) date and time at which the result was most recently
	 * detected. See "Date/time properties" in the SARIF spec for the required format.
	 */
	lastDetectionTimeUtc?: Date;
	/**
	 * Key/value pairs that provide additional information about the result.
	 */
	properties?: PropertyBag;
}

/**
 * A suppression that is relevant to a result.
 */
export interface Suppression {
	/**
	 * A stable, unique identifier for the suppression in the form of a GUID.
	 */
	guid?: string;
	/**
	 * A string representing the justification for the suppression.
	 */
	justification?: string;
	/**
	 * A string that indicates where the suppression is persisted.
	 */
	kind: SuppressionKind;
	/**
	 * Identifies the location associated with the suppression.
	 */
	location?: Location;
	/**
	 * Key/value pairs that provide additional information about the suppression.
	 */
	properties?: PropertyBag;
	/**
	 * A string that indicates the review status of the suppression.
	 */
	status?: Status;
}

/**
 * A string that indicates where the suppression is persisted.
 */
export enum SuppressionKind {
	External = "external",
	InSource = "inSource",
}

/**
 * A string that indicates the review status of the suppression.
 */
export enum Status {
	Accepted = "accepted",
	Rejected = "rejected",
	UnderReview = "underReview",
}

/**
 * The SARIF format version of this external properties object.
 *
 * The SARIF format version of this log file.
 */
export enum Version {
	The210 = "2.1.0",
}

/**
 * Describes a single run of an analysis tool, and contains the reported output of that run.
 */
export interface Run {
	/**
	 * Addresses associated with this run instance, if any.
	 */
	addresses?: Address[];
	/**
	 * An array of artifact objects relevant to the run.
	 */
	artifacts?: Artifact[];
	/**
	 * Automation details that describe this run.
	 */
	automationDetails?: RunAutomationDetails;
	/**
	 * The 'guid' property of a previous SARIF 'run' that comprises the baseline that was used
	 * to compute result 'baselineState' properties for the run.
	 */
	baselineGuid?: string;
	/**
	 * Specifies the unit in which the tool measures columns.
	 */
	columnKind?: ColumnKind;
	/**
	 * A conversion object that describes how a converter transformed an analysis tool's native
	 * reporting format into the SARIF format.
	 */
	conversion?: Conversion;
	/**
	 * Specifies the default encoding for any artifact object that refers to a text file.
	 */
	defaultEncoding?: string;
	/**
	 * Specifies the default source language for any artifact object that refers to a text file
	 * that contains source code.
	 */
	defaultSourceLanguage?: string;
	/**
	 * References to external property files that should be inlined with the content of a root
	 * log file.
	 */
	externalPropertyFileReferences?: ExternalPropertyFileReferences;
	/**
	 * An array of zero or more unique graph objects associated with the run.
	 */
	graphs?: Graph[];
	/**
	 * Describes the invocation of the analysis tool.
	 */
	invocations?: Invocation[];
	/**
	 * The language of the messages emitted into the log file during this run (expressed as an
	 * ISO 639-1 two-letter lowercase culture code) and an optional region (expressed as an ISO
	 * 3166-1 two-letter uppercase subculture code associated with a country or region). The
	 * casing is recommended but not required (in order for this data to conform to RFC5646).
	 */
	language?: string;
	/**
	 * An array of logical locations such as namespaces, types or functions.
	 */
	logicalLocations?: LogicalLocation[];
	/**
	 * An ordered list of character sequences that were treated as line breaks when computing
	 * region information for the run.
	 */
	newlineSequences?: string[];
	/**
	 * The artifact location specified by each uriBaseId symbol on the machine where the tool
	 * originally ran.
	 */
	originalUriBaseIds?: { [key: string]: ArtifactLocation };
	/**
	 * Contains configurations that may potentially override both
	 * reportingDescriptor.defaultConfiguration (the tool's default severities) and
	 * invocation.configurationOverrides (severities established at run-time from the command
	 * line).
	 */
	policies?: ToolComponent[];
	/**
	 * Key/value pairs that provide additional information about the run.
	 */
	properties?: PropertyBag;
	/**
	 * An array of strings used to replace sensitive information in a redaction-aware property.
	 */
	redactionTokens?: string[];
	/**
	 * The set of results contained in an SARIF log. The results array can be omitted when a run
	 * is solely exporting rules metadata. It must be present (but may be empty) if a log file
	 * represents an actual scan.
	 */
	results?: Result[];
	/**
	 * Automation details that describe the aggregate of runs to which this run belongs.
	 */
	runAggregates?: RunAutomationDetails[];
	/**
	 * A specialLocations object that defines locations of special significance to SARIF
	 * consumers.
	 */
	specialLocations?: SpecialLocations;
	/**
	 * An array of toolComponent objects relevant to a taxonomy in which results are categorized.
	 */
	taxonomies?: ToolComponent[];
	/**
	 * An array of threadFlowLocation objects cached at run level.
	 */
	threadFlowLocations?: ThreadFlowLocation[];
	/**
	 * Information about the tool or tool pipeline that generated the results in this run. A run
	 * can only contain results produced by a single tool or tool pipeline. A run can aggregate
	 * results from multiple log files, as long as context around the tool run (tool
	 * command-line arguments and the like) is identical for all aggregated files.
	 */
	tool: Tool;
	/**
	 * The set of available translations of the localized data provided by the tool.
	 */
	translations?: ToolComponent[];
	/**
	 * Specifies the revision in version control of the artifacts that were scanned.
	 */
	versionControlProvenance?: VersionControlDetails[];
	/**
	 * An array of request objects cached at run level.
	 */
	webRequests?: WebRequest[];
	/**
	 * An array of response objects cached at run level.
	 */
	webResponses?: WebResponse[];
}

/**
 * Automation details that describe this run.
 *
 * Information that describes a run's identity and role within an engineering system process.
 */
export interface RunAutomationDetails {
	/**
	 * A stable, unique identifier for the equivalence class of runs to which this object's
	 * containing run object belongs in the form of a GUID.
	 */
	correlationGuid?: string;
	/**
	 * A description of the identity and role played within the engineering system by this
	 * object's containing run object.
	 */
	description?: Message;
	/**
	 * A stable, unique identifier for this object's containing run object in the form of a GUID.
	 */
	guid?: string;
	/**
	 * A hierarchical string that uniquely identifies this object's containing run object.
	 */
	id?: string;
	/**
	 * Key/value pairs that provide additional information about the run automation details.
	 */
	properties?: PropertyBag;
}

/**
 * Specifies the unit in which the tool measures columns.
 */
export enum ColumnKind {
	UnicodeCodePoints = "unicodeCodePoints",
	Utf16CodeUnits = "utf16CodeUnits",
}

/**
 * References to external property files that should be inlined with the content of a root
 * log file.
 */
export interface ExternalPropertyFileReferences {
	/**
	 * An array of external property files containing run.addresses arrays to be merged with the
	 * root log file.
	 */
	addresses?: ExternalPropertyFileReference[];
	/**
	 * An array of external property files containing run.artifacts arrays to be merged with the
	 * root log file.
	 */
	artifacts?: ExternalPropertyFileReference[];
	/**
	 * An external property file containing a run.conversion object to be merged with the root
	 * log file.
	 */
	conversion?: ExternalPropertyFileReference;
	/**
	 * An external property file containing a run.driver object to be merged with the root log
	 * file.
	 */
	driver?: ExternalPropertyFileReference;
	/**
	 * An array of external property files containing run.extensions arrays to be merged with
	 * the root log file.
	 */
	extensions?: ExternalPropertyFileReference[];
	/**
	 * An external property file containing a run.properties object to be merged with the root
	 * log file.
	 */
	externalizedProperties?: ExternalPropertyFileReference;
	/**
	 * An array of external property files containing a run.graphs object to be merged with the
	 * root log file.
	 */
	graphs?: ExternalPropertyFileReference[];
	/**
	 * An array of external property files containing run.invocations arrays to be merged with
	 * the root log file.
	 */
	invocations?: ExternalPropertyFileReference[];
	/**
	 * An array of external property files containing run.logicalLocations arrays to be merged
	 * with the root log file.
	 */
	logicalLocations?: ExternalPropertyFileReference[];
	/**
	 * An array of external property files containing run.policies arrays to be merged with the
	 * root log file.
	 */
	policies?: ExternalPropertyFileReference[];
	/**
	 * Key/value pairs that provide additional information about the external property files.
	 */
	properties?: PropertyBag;
	/**
	 * An array of external property files containing run.results arrays to be merged with the
	 * root log file.
	 */
	results?: ExternalPropertyFileReference[];
	/**
	 * An array of external property files containing run.taxonomies arrays to be merged with
	 * the root log file.
	 */
	taxonomies?: ExternalPropertyFileReference[];
	/**
	 * An array of external property files containing run.threadFlowLocations arrays to be
	 * merged with the root log file.
	 */
	threadFlowLocations?: ExternalPropertyFileReference[];
	/**
	 * An array of external property files containing run.translations arrays to be merged with
	 * the root log file.
	 */
	translations?: ExternalPropertyFileReference[];
	/**
	 * An array of external property files containing run.requests arrays to be merged with the
	 * root log file.
	 */
	webRequests?: ExternalPropertyFileReference[];
	/**
	 * An array of external property files containing run.responses arrays to be merged with the
	 * root log file.
	 */
	webResponses?: ExternalPropertyFileReference[];
}

/**
 * An external property file containing a run.conversion object to be merged with the root
 * log file.
 *
 * An external property file containing a run.driver object to be merged with the root log
 * file.
 *
 * An external property file containing a run.properties object to be merged with the root
 * log file.
 *
 * Contains information that enables a SARIF consumer to locate the external property file
 * that contains the value of an externalized property associated with the run.
 */
export interface ExternalPropertyFileReference {
	/**
	 * A stable, unique identifier for the external property file in the form of a GUID.
	 */
	guid?: string;
	/**
	 * A non-negative integer specifying the number of items contained in the external property
	 * file.
	 */
	itemCount?: number;
	/**
	 * The location of the external property file.
	 */
	location?: ArtifactLocation;
	/**
	 * Key/value pairs that provide additional information about the external property file.
	 */
	properties?: PropertyBag;
}

/**
 * A specialLocations object that defines locations of special significance to SARIF
 * consumers.
 *
 * Defines locations of special significance to SARIF consumers.
 */
export interface SpecialLocations {
	/**
	 * Provides a suggestion to SARIF consumers to display file paths relative to the specified
	 * location.
	 */
	displayBase?: ArtifactLocation;
	/**
	 * Key/value pairs that provide additional information about the special locations.
	 */
	properties?: PropertyBag;
}

/**
 * Specifies the information necessary to retrieve a desired revision from a version control
 * system.
 */
export interface VersionControlDetails {
	/**
	 * A Coordinated Universal Time (UTC) date and time that can be used to synchronize an
	 * enlistment to the state of the repository at that time.
	 */
	asOfTimeUtc?: Date;
	/**
	 * The name of a branch containing the revision.
	 */
	branch?: string;
	/**
	 * The location in the local file system to which the root of the repository was mapped at
	 * the time of the analysis.
	 */
	mappedTo?: ArtifactLocation;
	/**
	 * Key/value pairs that provide additional information about the version control details.
	 */
	properties?: PropertyBag;
	/**
	 * The absolute URI of the repository.
	 */
	repositoryUri: string;
	/**
	 * A string that uniquely and permanently identifies the revision within the repository.
	 */
	revisionId?: string;
	/**
	 * A tag that has been applied to the revision.
	 */
	revisionTag?: string;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
	public static toSecretLintOutput(json: string): SecretLintOutput {
		return cast(JSON.parse(json), r("SecretLintOutput"));
	}

	public static SecretLintOutputToJson(value: SecretLintOutput): string {
		return JSON.stringify(uncast(value, r("SecretLintOutput")), null, 2);
	}
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
	const prettyTyp = prettyTypeName(typ);
	const parentText = parent ? ` on ${parent}` : '';
	const keyText = key ? ` for key "${key}"` : '';
	throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
	if (Array.isArray(typ)) {
		if (typ.length === 2 && typ[0] === undefined) {
			return `an optional ${prettyTypeName(typ[1])}`;
		} else {
			return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
		}
	} else if (typeof typ === "object" && typ.literal !== undefined) {
		return typ.literal;
	} else {
		return typeof typ;
	}
}

function jsonToJSProps(typ: any): any {
	if (typ.jsonToJS === undefined) {
		const map: any = {};
		typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
		typ.jsonToJS = map;
	}
	return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
	if (typ.jsToJSON === undefined) {
		const map: any = {};
		typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
		typ.jsToJSON = map;
	}
	return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
	function transformPrimitive(typ: string, val: any): any {
		if (typeof typ === typeof val) return val;
		return invalidValue(typ, val, key, parent);
	}

	function transformUnion(typs: any[], val: any): any {
		// val must validate against one typ in typs
		const l = typs.length;
		for (let i = 0; i < l; i++) {
			const typ = typs[i];
			try {
				return transform(val, typ, getProps);
			} catch (_) { }
		}
		return invalidValue(typs, val, key, parent);
	}

	function transformEnum(cases: string[], val: any): any {
		if (cases.indexOf(val) !== -1) return val;
		return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
	}

	function transformArray(typ: any, val: any): any {
		// val must be an array with no invalid elements
		if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
		return val.map(el => transform(el, typ, getProps));
	}

	function transformDate(val: any): any {
		if (val === null) {
			return null;
		}
		const d = new Date(val);
		if (isNaN(d.valueOf())) {
			return invalidValue(l("Date"), val, key, parent);
		}
		return d;
	}

	function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
		if (val === null || typeof val !== "object" || Array.isArray(val)) {
			return invalidValue(l(ref || "object"), val, key, parent);
		}
		const result: any = {};
		Object.getOwnPropertyNames(props).forEach(key => {
			const prop = props[key];
			const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
			result[prop.key] = transform(v, prop.typ, getProps, key, ref);
		});
		Object.getOwnPropertyNames(val).forEach(key => {
			if (!Object.prototype.hasOwnProperty.call(props, key)) {
				result[key] = transform(val[key], additional, getProps, key, ref);
			}
		});
		return result;
	}

	if (typ === "any") return val;
	if (typ === null) {
		if (val === null) return val;
		return invalidValue(typ, val, key, parent);
	}
	if (typ === false) return invalidValue(typ, val, key, parent);
	let ref: any = undefined;
	while (typeof typ === "object" && typ.ref !== undefined) {
		ref = typ.ref;
		typ = typeMap[typ.ref];
	}
	if (Array.isArray(typ)) return transformEnum(typ, val);
	if (typeof typ === "object") {
		return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
			: typ.hasOwnProperty("arrayItems") ? transformArray(typ.arrayItems, val)
				: typ.hasOwnProperty("props") ? transformObject(getProps(typ), typ.additional, val)
					: invalidValue(typ, val, key, parent);
	}
	// Numbers can be parsed by Date but shouldn't be.
	if (typ === Date && typeof val !== "number") return transformDate(val);
	return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
	return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
	return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
	return { literal: typ };
}

function a(typ: any) {
	return { arrayItems: typ };
}

function u(...typs: any[]) {
	return { unionMembers: typs };
}

function o(props: any[], additional: any) {
	return { props, additional };
}

function m(additional: any) {
	return { props: [], additional };
}

function r(name: string) {
	return { ref: name };
}

const typeMap: any = {
	"SecretLintOutput": o([
		{ json: "$schema", js: "$schema", typ: u(undefined, "") },
		{ json: "inlineExternalProperties", js: "inlineExternalProperties", typ: u(undefined, a(r("ExternalProperties"))) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "runs", js: "runs", typ: a(r("Run")) },
		{ json: "version", js: "version", typ: r("Version") },
	], false),
	"ExternalProperties": o([
		{ json: "addresses", js: "addresses", typ: u(undefined, a(r("Address"))) },
		{ json: "artifacts", js: "artifacts", typ: u(undefined, a(r("Artifact"))) },
		{ json: "conversion", js: "conversion", typ: u(undefined, r("Conversion")) },
		{ json: "driver", js: "driver", typ: u(undefined, r("ToolComponent")) },
		{ json: "extensions", js: "extensions", typ: u(undefined, a(r("ToolComponent"))) },
		{ json: "externalizedProperties", js: "externalizedProperties", typ: u(undefined, r("PropertyBag")) },
		{ json: "graphs", js: "graphs", typ: u(undefined, a(r("Graph"))) },
		{ json: "guid", js: "guid", typ: u(undefined, "") },
		{ json: "invocations", js: "invocations", typ: u(undefined, a(r("Invocation"))) },
		{ json: "logicalLocations", js: "logicalLocations", typ: u(undefined, a(r("LogicalLocation"))) },
		{ json: "policies", js: "policies", typ: u(undefined, a(r("ToolComponent"))) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "results", js: "results", typ: u(undefined, a(r("Result"))) },
		{ json: "runGuid", js: "runGuid", typ: u(undefined, "") },
		{ json: "schema", js: "schema", typ: u(undefined, "") },
		{ json: "taxonomies", js: "taxonomies", typ: u(undefined, a(r("ToolComponent"))) },
		{ json: "threadFlowLocations", js: "threadFlowLocations", typ: u(undefined, a(r("ThreadFlowLocation"))) },
		{ json: "translations", js: "translations", typ: u(undefined, a(r("ToolComponent"))) },
		{ json: "version", js: "version", typ: u(undefined, r("Version")) },
		{ json: "webRequests", js: "webRequests", typ: u(undefined, a(r("WebRequest"))) },
		{ json: "webResponses", js: "webResponses", typ: u(undefined, a(r("WebResponse"))) },
	], false),
	"Address": o([
		{ json: "absoluteAddress", js: "absoluteAddress", typ: u(undefined, 0) },
		{ json: "fullyQualifiedName", js: "fullyQualifiedName", typ: u(undefined, "") },
		{ json: "index", js: "index", typ: u(undefined, 0) },
		{ json: "kind", js: "kind", typ: u(undefined, "") },
		{ json: "length", js: "length", typ: u(undefined, 0) },
		{ json: "name", js: "name", typ: u(undefined, "") },
		{ json: "offsetFromParent", js: "offsetFromParent", typ: u(undefined, 0) },
		{ json: "parentIndex", js: "parentIndex", typ: u(undefined, 0) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "relativeAddress", js: "relativeAddress", typ: u(undefined, 0) },
	], false),
	"PropertyBag": o([
		{ json: "tags", js: "tags", typ: u(undefined, a("")) },
	], "any"),
	"Artifact": o([
		{ json: "contents", js: "contents", typ: u(undefined, r("ArtifactContent")) },
		{ json: "description", js: "description", typ: u(undefined, r("Message")) },
		{ json: "encoding", js: "encoding", typ: u(undefined, "") },
		{ json: "hashes", js: "hashes", typ: u(undefined, m("")) },
		{ json: "lastModifiedTimeUtc", js: "lastModifiedTimeUtc", typ: u(undefined, Date) },
		{ json: "length", js: "length", typ: u(undefined, 0) },
		{ json: "location", js: "location", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "mimeType", js: "mimeType", typ: u(undefined, "") },
		{ json: "offset", js: "offset", typ: u(undefined, 0) },
		{ json: "parentIndex", js: "parentIndex", typ: u(undefined, 0) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "roles", js: "roles", typ: u(undefined, a(r("Role"))) },
		{ json: "sourceLanguage", js: "sourceLanguage", typ: u(undefined, "") },
	], false),
	"ArtifactContent": o([
		{ json: "binary", js: "binary", typ: u(undefined, "") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "rendered", js: "rendered", typ: u(undefined, r("MultiformatMessageString")) },
		{ json: "text", js: "text", typ: u(undefined, "") },
	], false),
	"MultiformatMessageString": o([
		{ json: "markdown", js: "markdown", typ: u(undefined, "") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "text", js: "text", typ: "" },
	], false),
	"Message": o([
		{ json: "arguments", js: "arguments", typ: u(undefined, a("")) },
		{ json: "id", js: "id", typ: u(undefined, "") },
		{ json: "markdown", js: "markdown", typ: u(undefined, "") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "text", js: "text", typ: u(undefined, "") },
	], false),
	"ArtifactLocation": o([
		{ json: "description", js: "description", typ: u(undefined, r("Message")) },
		{ json: "index", js: "index", typ: u(undefined, 0) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "uri", js: "uri", typ: u(undefined, "") },
		{ json: "uriBaseId", js: "uriBaseId", typ: u(undefined, "") },
	], false),
	"Conversion": o([
		{ json: "analysisToolLogFiles", js: "analysisToolLogFiles", typ: u(undefined, a(r("ArtifactLocation"))) },
		{ json: "invocation", js: "invocation", typ: u(undefined, r("Invocation")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "tool", js: "tool", typ: r("Tool") },
	], false),
	"Invocation": o([
		{ json: "account", js: "account", typ: u(undefined, "") },
		{ json: "arguments", js: "arguments", typ: u(undefined, a("")) },
		{ json: "commandLine", js: "commandLine", typ: u(undefined, "") },
		{ json: "endTimeUtc", js: "endTimeUtc", typ: u(undefined, Date) },
		{ json: "environmentVariables", js: "environmentVariables", typ: u(undefined, m("")) },
		{ json: "executableLocation", js: "executableLocation", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "executionSuccessful", js: "executionSuccessful", typ: true },
		{ json: "exitCode", js: "exitCode", typ: u(undefined, 0) },
		{ json: "exitCodeDescription", js: "exitCodeDescription", typ: u(undefined, "") },
		{ json: "exitSignalName", js: "exitSignalName", typ: u(undefined, "") },
		{ json: "exitSignalNumber", js: "exitSignalNumber", typ: u(undefined, 0) },
		{ json: "machine", js: "machine", typ: u(undefined, "") },
		{ json: "notificationConfigurationOverrides", js: "notificationConfigurationOverrides", typ: u(undefined, a(r("ConfigurationOverride"))) },
		{ json: "processId", js: "processId", typ: u(undefined, 0) },
		{ json: "processStartFailureMessage", js: "processStartFailureMessage", typ: u(undefined, "") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "responseFiles", js: "responseFiles", typ: u(undefined, a(r("ArtifactLocation"))) },
		{ json: "ruleConfigurationOverrides", js: "ruleConfigurationOverrides", typ: u(undefined, a(r("ConfigurationOverride"))) },
		{ json: "startTimeUtc", js: "startTimeUtc", typ: u(undefined, Date) },
		{ json: "stderr", js: "stderr", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "stdin", js: "stdin", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "stdout", js: "stdout", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "stdoutStderr", js: "stdoutStderr", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "toolConfigurationNotifications", js: "toolConfigurationNotifications", typ: u(undefined, a(r("Notification"))) },
		{ json: "toolExecutionNotifications", js: "toolExecutionNotifications", typ: u(undefined, a(r("Notification"))) },
		{ json: "workingDirectory", js: "workingDirectory", typ: u(undefined, r("ArtifactLocation")) },
	], false),
	"ConfigurationOverride": o([
		{ json: "configuration", js: "configuration", typ: r("ReportingConfiguration") },
		{ json: "descriptor", js: "descriptor", typ: r("ReportingDescriptorReference") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"ReportingConfiguration": o([
		{ json: "enabled", js: "enabled", typ: u(undefined, true) },
		{ json: "level", js: "level", typ: u(undefined, r("Level")) },
		{ json: "parameters", js: "parameters", typ: u(undefined, r("PropertyBag")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "rank", js: "rank", typ: u(undefined, 3.14) },
	], false),
	"ReportingDescriptorReference": o([
		{ json: "guid", js: "guid", typ: u(undefined, "") },
		{ json: "id", js: "id", typ: u(undefined, "") },
		{ json: "index", js: "index", typ: u(undefined, 0) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "toolComponent", js: "toolComponent", typ: u(undefined, r("ToolComponentReference")) },
	], false),
	"ToolComponentReference": o([
		{ json: "guid", js: "guid", typ: u(undefined, "") },
		{ json: "index", js: "index", typ: u(undefined, 0) },
		{ json: "name", js: "name", typ: u(undefined, "") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"Notification": o([
		{ json: "associatedRule", js: "associatedRule", typ: u(undefined, r("ReportingDescriptorReference")) },
		{ json: "descriptor", js: "descriptor", typ: u(undefined, r("ReportingDescriptorReference")) },
		{ json: "exception", js: "exception", typ: u(undefined, r("Exception")) },
		{ json: "level", js: "level", typ: u(undefined, r("Level")) },
		{ json: "locations", js: "locations", typ: u(undefined, a(r("Location"))) },
		{ json: "message", js: "message", typ: r("Message") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "threadId", js: "threadId", typ: u(undefined, 0) },
		{ json: "timeUtc", js: "timeUtc", typ: u(undefined, Date) },
	], false),
	"Exception": o([
		{ json: "innerExceptions", js: "innerExceptions", typ: u(undefined, a(r("Exception"))) },
		{ json: "kind", js: "kind", typ: u(undefined, "") },
		{ json: "message", js: "message", typ: u(undefined, "") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "stack", js: "stack", typ: u(undefined, r("Stack")) },
	], false),
	"Stack": o([
		{ json: "frames", js: "frames", typ: a(r("StackFrame")) },
		{ json: "message", js: "message", typ: u(undefined, r("Message")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"StackFrame": o([
		{ json: "location", js: "location", typ: u(undefined, r("Location")) },
		{ json: "module", js: "module", typ: u(undefined, "") },
		{ json: "parameters", js: "parameters", typ: u(undefined, a("")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "threadId", js: "threadId", typ: u(undefined, 0) },
	], false),
	"Location": o([
		{ json: "annotations", js: "annotations", typ: u(undefined, a(r("Region"))) },
		{ json: "id", js: "id", typ: u(undefined, 0) },
		{ json: "logicalLocations", js: "logicalLocations", typ: u(undefined, a(r("LogicalLocation"))) },
		{ json: "message", js: "message", typ: u(undefined, r("Message")) },
		{ json: "physicalLocation", js: "physicalLocation", typ: u(undefined, r("PhysicalLocation")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "relationships", js: "relationships", typ: u(undefined, a(r("LocationRelationship"))) },
	], false),
	"Region": o([
		{ json: "byteLength", js: "byteLength", typ: u(undefined, 0) },
		{ json: "byteOffset", js: "byteOffset", typ: u(undefined, 0) },
		{ json: "charLength", js: "charLength", typ: u(undefined, 0) },
		{ json: "charOffset", js: "charOffset", typ: u(undefined, 0) },
		{ json: "endColumn", js: "endColumn", typ: u(undefined, 0) },
		{ json: "endLine", js: "endLine", typ: u(undefined, 0) },
		{ json: "message", js: "message", typ: u(undefined, r("Message")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "snippet", js: "snippet", typ: u(undefined, r("ArtifactContent")) },
		{ json: "sourceLanguage", js: "sourceLanguage", typ: u(undefined, "") },
		{ json: "startColumn", js: "startColumn", typ: u(undefined, 0) },
		{ json: "startLine", js: "startLine", typ: u(undefined, 0) },
	], false),
	"LogicalLocation": o([
		{ json: "decoratedName", js: "decoratedName", typ: u(undefined, "") },
		{ json: "fullyQualifiedName", js: "fullyQualifiedName", typ: u(undefined, "") },
		{ json: "index", js: "index", typ: u(undefined, 0) },
		{ json: "kind", js: "kind", typ: u(undefined, "") },
		{ json: "name", js: "name", typ: u(undefined, "") },
		{ json: "parentIndex", js: "parentIndex", typ: u(undefined, 0) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"PhysicalLocation": o([
		{ json: "address", js: "address", typ: u(undefined, r("Address")) },
		{ json: "artifactLocation", js: "artifactLocation", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "contextRegion", js: "contextRegion", typ: u(undefined, r("Region")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "region", js: "region", typ: u(undefined, r("Region")) },
	], false),
	"LocationRelationship": o([
		{ json: "description", js: "description", typ: u(undefined, r("Message")) },
		{ json: "kinds", js: "kinds", typ: u(undefined, a("")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "target", js: "target", typ: 0 },
	], false),
	"Tool": o([
		{ json: "driver", js: "driver", typ: r("ToolComponent") },
		{ json: "extensions", js: "extensions", typ: u(undefined, a(r("ToolComponent"))) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"ToolComponent": o([
		{ json: "associatedComponent", js: "associatedComponent", typ: u(undefined, r("ToolComponentReference")) },
		{ json: "contents", js: "contents", typ: u(undefined, a(r("Content"))) },
		{ json: "dottedQuadFileVersion", js: "dottedQuadFileVersion", typ: u(undefined, "") },
		{ json: "downloadUri", js: "downloadUri", typ: u(undefined, "") },
		{ json: "fullDescription", js: "fullDescription", typ: u(undefined, r("MultiformatMessageString")) },
		{ json: "fullName", js: "fullName", typ: u(undefined, "") },
		{ json: "globalMessageStrings", js: "globalMessageStrings", typ: u(undefined, m(r("MultiformatMessageString"))) },
		{ json: "guid", js: "guid", typ: u(undefined, "") },
		{ json: "informationUri", js: "informationUri", typ: u(undefined, "") },
		{ json: "isComprehensive", js: "isComprehensive", typ: u(undefined, true) },
		{ json: "language", js: "language", typ: u(undefined, "") },
		{ json: "localizedDataSemanticVersion", js: "localizedDataSemanticVersion", typ: u(undefined, "") },
		{ json: "locations", js: "locations", typ: u(undefined, a(r("ArtifactLocation"))) },
		{ json: "minimumRequiredLocalizedDataSemanticVersion", js: "minimumRequiredLocalizedDataSemanticVersion", typ: u(undefined, "") },
		{ json: "name", js: "name", typ: "" },
		{ json: "notifications", js: "notifications", typ: u(undefined, a(r("ReportingDescriptor"))) },
		{ json: "organization", js: "organization", typ: u(undefined, "") },
		{ json: "product", js: "product", typ: u(undefined, "") },
		{ json: "productSuite", js: "productSuite", typ: u(undefined, "") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "releaseDateUtc", js: "releaseDateUtc", typ: u(undefined, "") },
		{ json: "rules", js: "rules", typ: u(undefined, a(r("ReportingDescriptor"))) },
		{ json: "semanticVersion", js: "semanticVersion", typ: u(undefined, "") },
		{ json: "shortDescription", js: "shortDescription", typ: u(undefined, r("MultiformatMessageString")) },
		{ json: "supportedTaxonomies", js: "supportedTaxonomies", typ: u(undefined, a(r("ToolComponentReference"))) },
		{ json: "taxa", js: "taxa", typ: u(undefined, a(r("ReportingDescriptor"))) },
		{ json: "translationMetadata", js: "translationMetadata", typ: u(undefined, r("TranslationMetadata")) },
		{ json: "version", js: "version", typ: u(undefined, "") },
	], false),
	"ReportingDescriptor": o([
		{ json: "defaultConfiguration", js: "defaultConfiguration", typ: u(undefined, r("ReportingConfiguration")) },
		{ json: "deprecatedGuids", js: "deprecatedGuids", typ: u(undefined, a("")) },
		{ json: "deprecatedIds", js: "deprecatedIds", typ: u(undefined, a("")) },
		{ json: "deprecatedNames", js: "deprecatedNames", typ: u(undefined, a("")) },
		{ json: "fullDescription", js: "fullDescription", typ: u(undefined, r("MultiformatMessageString")) },
		{ json: "guid", js: "guid", typ: u(undefined, "") },
		{ json: "help", js: "help", typ: u(undefined, r("MultiformatMessageString")) },
		{ json: "helpUri", js: "helpUri", typ: u(undefined, "") },
		{ json: "id", js: "id", typ: "" },
		{ json: "messageStrings", js: "messageStrings", typ: u(undefined, m(r("MultiformatMessageString"))) },
		{ json: "name", js: "name", typ: u(undefined, "") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "relationships", js: "relationships", typ: u(undefined, a(r("ReportingDescriptorRelationship"))) },
		{ json: "shortDescription", js: "shortDescription", typ: u(undefined, r("MultiformatMessageString")) },
	], false),
	"ReportingDescriptorRelationship": o([
		{ json: "description", js: "description", typ: u(undefined, r("Message")) },
		{ json: "kinds", js: "kinds", typ: u(undefined, a("")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "target", js: "target", typ: r("ReportingDescriptorReference") },
	], false),
	"TranslationMetadata": o([
		{ json: "downloadUri", js: "downloadUri", typ: u(undefined, "") },
		{ json: "fullDescription", js: "fullDescription", typ: u(undefined, r("MultiformatMessageString")) },
		{ json: "fullName", js: "fullName", typ: u(undefined, "") },
		{ json: "informationUri", js: "informationUri", typ: u(undefined, "") },
		{ json: "name", js: "name", typ: "" },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "shortDescription", js: "shortDescription", typ: u(undefined, r("MultiformatMessageString")) },
	], false),
	"Graph": o([
		{ json: "description", js: "description", typ: u(undefined, r("Message")) },
		{ json: "edges", js: "edges", typ: u(undefined, a(r("Edge"))) },
		{ json: "nodes", js: "nodes", typ: u(undefined, a(r("Node"))) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"Edge": o([
		{ json: "id", js: "id", typ: "" },
		{ json: "label", js: "label", typ: u(undefined, r("Message")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "sourceNodeId", js: "sourceNodeId", typ: "" },
		{ json: "targetNodeId", js: "targetNodeId", typ: "" },
	], false),
	"Node": o([
		{ json: "children", js: "children", typ: u(undefined, a(r("Node"))) },
		{ json: "id", js: "id", typ: "" },
		{ json: "label", js: "label", typ: u(undefined, r("Message")) },
		{ json: "location", js: "location", typ: u(undefined, r("Location")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"Result": o([
		{ json: "analysisTarget", js: "analysisTarget", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "attachments", js: "attachments", typ: u(undefined, a(r("Attachment"))) },
		{ json: "baselineState", js: "baselineState", typ: u(undefined, r("BaselineState")) },
		{ json: "codeFlows", js: "codeFlows", typ: u(undefined, a(r("CodeFlow"))) },
		{ json: "correlationGuid", js: "correlationGuid", typ: u(undefined, "") },
		{ json: "fingerprints", js: "fingerprints", typ: u(undefined, m("")) },
		{ json: "fixes", js: "fixes", typ: u(undefined, a(r("Fix"))) },
		{ json: "graphs", js: "graphs", typ: u(undefined, a(r("Graph"))) },
		{ json: "graphTraversals", js: "graphTraversals", typ: u(undefined, a(r("GraphTraversal"))) },
		{ json: "guid", js: "guid", typ: u(undefined, "") },
		{ json: "hostedViewerUri", js: "hostedViewerUri", typ: u(undefined, "") },
		{ json: "kind", js: "kind", typ: u(undefined, r("ResultKind")) },
		{ json: "level", js: "level", typ: u(undefined, r("Level")) },
		{ json: "locations", js: "locations", typ: u(undefined, a(r("Location"))) },
		{ json: "message", js: "message", typ: r("Message") },
		{ json: "occurrenceCount", js: "occurrenceCount", typ: u(undefined, 0) },
		{ json: "partialFingerprints", js: "partialFingerprints", typ: u(undefined, m("")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "provenance", js: "provenance", typ: u(undefined, r("ResultProvenance")) },
		{ json: "rank", js: "rank", typ: u(undefined, 3.14) },
		{ json: "relatedLocations", js: "relatedLocations", typ: u(undefined, a(r("Location"))) },
		{ json: "rule", js: "rule", typ: u(undefined, r("ReportingDescriptorReference")) },
		{ json: "ruleId", js: "ruleId", typ: u(undefined, "") },
		{ json: "ruleIndex", js: "ruleIndex", typ: u(undefined, 0) },
		{ json: "stacks", js: "stacks", typ: u(undefined, a(r("Stack"))) },
		{ json: "suppressions", js: "suppressions", typ: u(undefined, a(r("Suppression"))) },
		{ json: "taxa", js: "taxa", typ: u(undefined, a(r("ReportingDescriptorReference"))) },
		{ json: "webRequest", js: "webRequest", typ: u(undefined, r("WebRequest")) },
		{ json: "webResponse", js: "webResponse", typ: u(undefined, r("WebResponse")) },
		{ json: "workItemUris", js: "workItemUris", typ: u(undefined, a("")) },
	], false),
	"Attachment": o([
		{ json: "artifactLocation", js: "artifactLocation", typ: r("ArtifactLocation") },
		{ json: "description", js: "description", typ: u(undefined, r("Message")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "rectangles", js: "rectangles", typ: u(undefined, a(r("Rectangle"))) },
		{ json: "regions", js: "regions", typ: u(undefined, a(r("Region"))) },
	], false),
	"Rectangle": o([
		{ json: "bottom", js: "bottom", typ: u(undefined, 3.14) },
		{ json: "left", js: "left", typ: u(undefined, 3.14) },
		{ json: "message", js: "message", typ: u(undefined, r("Message")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "right", js: "right", typ: u(undefined, 3.14) },
		{ json: "top", js: "top", typ: u(undefined, 3.14) },
	], false),
	"CodeFlow": o([
		{ json: "message", js: "message", typ: u(undefined, r("Message")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "threadFlows", js: "threadFlows", typ: a(r("ThreadFlow")) },
	], false),
	"ThreadFlow": o([
		{ json: "id", js: "id", typ: u(undefined, "") },
		{ json: "immutableState", js: "immutableState", typ: u(undefined, m(r("MultiformatMessageString"))) },
		{ json: "initialState", js: "initialState", typ: u(undefined, m(r("MultiformatMessageString"))) },
		{ json: "locations", js: "locations", typ: a(r("ThreadFlowLocation")) },
		{ json: "message", js: "message", typ: u(undefined, r("Message")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"ThreadFlowLocation": o([
		{ json: "executionOrder", js: "executionOrder", typ: u(undefined, 0) },
		{ json: "executionTimeUtc", js: "executionTimeUtc", typ: u(undefined, Date) },
		{ json: "importance", js: "importance", typ: u(undefined, r("Importance")) },
		{ json: "index", js: "index", typ: u(undefined, 0) },
		{ json: "kinds", js: "kinds", typ: u(undefined, a("")) },
		{ json: "location", js: "location", typ: u(undefined, r("Location")) },
		{ json: "module", js: "module", typ: u(undefined, "") },
		{ json: "nestingLevel", js: "nestingLevel", typ: u(undefined, 0) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "stack", js: "stack", typ: u(undefined, r("Stack")) },
		{ json: "state", js: "state", typ: u(undefined, m(r("MultiformatMessageString"))) },
		{ json: "taxa", js: "taxa", typ: u(undefined, a(r("ReportingDescriptorReference"))) },
		{ json: "webRequest", js: "webRequest", typ: u(undefined, r("WebRequest")) },
		{ json: "webResponse", js: "webResponse", typ: u(undefined, r("WebResponse")) },
	], false),
	"WebRequest": o([
		{ json: "body", js: "body", typ: u(undefined, r("ArtifactContent")) },
		{ json: "headers", js: "headers", typ: u(undefined, m("")) },
		{ json: "index", js: "index", typ: u(undefined, 0) },
		{ json: "method", js: "method", typ: u(undefined, "") },
		{ json: "parameters", js: "parameters", typ: u(undefined, m("")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "protocol", js: "protocol", typ: u(undefined, "") },
		{ json: "target", js: "target", typ: u(undefined, "") },
		{ json: "version", js: "version", typ: u(undefined, "") },
	], false),
	"WebResponse": o([
		{ json: "body", js: "body", typ: u(undefined, r("ArtifactContent")) },
		{ json: "headers", js: "headers", typ: u(undefined, m("")) },
		{ json: "index", js: "index", typ: u(undefined, 0) },
		{ json: "noResponseReceived", js: "noResponseReceived", typ: u(undefined, true) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "protocol", js: "protocol", typ: u(undefined, "") },
		{ json: "reasonPhrase", js: "reasonPhrase", typ: u(undefined, "") },
		{ json: "statusCode", js: "statusCode", typ: u(undefined, 0) },
		{ json: "version", js: "version", typ: u(undefined, "") },
	], false),
	"Fix": o([
		{ json: "artifactChanges", js: "artifactChanges", typ: a(r("ArtifactChange")) },
		{ json: "description", js: "description", typ: u(undefined, r("Message")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"ArtifactChange": o([
		{ json: "artifactLocation", js: "artifactLocation", typ: r("ArtifactLocation") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "replacements", js: "replacements", typ: a(r("Replacement")) },
	], false),
	"Replacement": o([
		{ json: "deletedRegion", js: "deletedRegion", typ: r("Region") },
		{ json: "insertedContent", js: "insertedContent", typ: u(undefined, r("ArtifactContent")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"GraphTraversal": o([
		{ json: "description", js: "description", typ: u(undefined, r("Message")) },
		{ json: "edgeTraversals", js: "edgeTraversals", typ: u(undefined, a(r("EdgeTraversal"))) },
		{ json: "immutableState", js: "immutableState", typ: u(undefined, m(r("MultiformatMessageString"))) },
		{ json: "initialState", js: "initialState", typ: u(undefined, m(r("MultiformatMessageString"))) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "resultGraphIndex", js: "resultGraphIndex", typ: u(undefined, 0) },
		{ json: "runGraphIndex", js: "runGraphIndex", typ: u(undefined, 0) },
	], false),
	"EdgeTraversal": o([
		{ json: "edgeId", js: "edgeId", typ: "" },
		{ json: "finalState", js: "finalState", typ: u(undefined, m(r("MultiformatMessageString"))) },
		{ json: "message", js: "message", typ: u(undefined, r("Message")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "stepOverEdgeCount", js: "stepOverEdgeCount", typ: u(undefined, 0) },
	], false),
	"ResultProvenance": o([
		{ json: "conversionSources", js: "conversionSources", typ: u(undefined, a(r("PhysicalLocation"))) },
		{ json: "firstDetectionRunGuid", js: "firstDetectionRunGuid", typ: u(undefined, "") },
		{ json: "firstDetectionTimeUtc", js: "firstDetectionTimeUtc", typ: u(undefined, Date) },
		{ json: "invocationIndex", js: "invocationIndex", typ: u(undefined, 0) },
		{ json: "lastDetectionRunGuid", js: "lastDetectionRunGuid", typ: u(undefined, "") },
		{ json: "lastDetectionTimeUtc", js: "lastDetectionTimeUtc", typ: u(undefined, Date) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"Suppression": o([
		{ json: "guid", js: "guid", typ: u(undefined, "") },
		{ json: "justification", js: "justification", typ: u(undefined, "") },
		{ json: "kind", js: "kind", typ: r("SuppressionKind") },
		{ json: "location", js: "location", typ: u(undefined, r("Location")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "status", js: "status", typ: u(undefined, r("Status")) },
	], false),
	"Run": o([
		{ json: "addresses", js: "addresses", typ: u(undefined, a(r("Address"))) },
		{ json: "artifacts", js: "artifacts", typ: u(undefined, a(r("Artifact"))) },
		{ json: "automationDetails", js: "automationDetails", typ: u(undefined, r("RunAutomationDetails")) },
		{ json: "baselineGuid", js: "baselineGuid", typ: u(undefined, "") },
		{ json: "columnKind", js: "columnKind", typ: u(undefined, r("ColumnKind")) },
		{ json: "conversion", js: "conversion", typ: u(undefined, r("Conversion")) },
		{ json: "defaultEncoding", js: "defaultEncoding", typ: u(undefined, "") },
		{ json: "defaultSourceLanguage", js: "defaultSourceLanguage", typ: u(undefined, "") },
		{ json: "externalPropertyFileReferences", js: "externalPropertyFileReferences", typ: u(undefined, r("ExternalPropertyFileReferences")) },
		{ json: "graphs", js: "graphs", typ: u(undefined, a(r("Graph"))) },
		{ json: "invocations", js: "invocations", typ: u(undefined, a(r("Invocation"))) },
		{ json: "language", js: "language", typ: u(undefined, "") },
		{ json: "logicalLocations", js: "logicalLocations", typ: u(undefined, a(r("LogicalLocation"))) },
		{ json: "newlineSequences", js: "newlineSequences", typ: u(undefined, a("")) },
		{ json: "originalUriBaseIds", js: "originalUriBaseIds", typ: u(undefined, m(r("ArtifactLocation"))) },
		{ json: "policies", js: "policies", typ: u(undefined, a(r("ToolComponent"))) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "redactionTokens", js: "redactionTokens", typ: u(undefined, a("")) },
		{ json: "results", js: "results", typ: u(undefined, a(r("Result"))) },
		{ json: "runAggregates", js: "runAggregates", typ: u(undefined, a(r("RunAutomationDetails"))) },
		{ json: "specialLocations", js: "specialLocations", typ: u(undefined, r("SpecialLocations")) },
		{ json: "taxonomies", js: "taxonomies", typ: u(undefined, a(r("ToolComponent"))) },
		{ json: "threadFlowLocations", js: "threadFlowLocations", typ: u(undefined, a(r("ThreadFlowLocation"))) },
		{ json: "tool", js: "tool", typ: r("Tool") },
		{ json: "translations", js: "translations", typ: u(undefined, a(r("ToolComponent"))) },
		{ json: "versionControlProvenance", js: "versionControlProvenance", typ: u(undefined, a(r("VersionControlDetails"))) },
		{ json: "webRequests", js: "webRequests", typ: u(undefined, a(r("WebRequest"))) },
		{ json: "webResponses", js: "webResponses", typ: u(undefined, a(r("WebResponse"))) },
	], false),
	"RunAutomationDetails": o([
		{ json: "correlationGuid", js: "correlationGuid", typ: u(undefined, "") },
		{ json: "description", js: "description", typ: u(undefined, r("Message")) },
		{ json: "guid", js: "guid", typ: u(undefined, "") },
		{ json: "id", js: "id", typ: u(undefined, "") },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"ExternalPropertyFileReferences": o([
		{ json: "addresses", js: "addresses", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "artifacts", js: "artifacts", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "conversion", js: "conversion", typ: u(undefined, r("ExternalPropertyFileReference")) },
		{ json: "driver", js: "driver", typ: u(undefined, r("ExternalPropertyFileReference")) },
		{ json: "extensions", js: "extensions", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "externalizedProperties", js: "externalizedProperties", typ: u(undefined, r("ExternalPropertyFileReference")) },
		{ json: "graphs", js: "graphs", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "invocations", js: "invocations", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "logicalLocations", js: "logicalLocations", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "policies", js: "policies", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "results", js: "results", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "taxonomies", js: "taxonomies", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "threadFlowLocations", js: "threadFlowLocations", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "translations", js: "translations", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "webRequests", js: "webRequests", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
		{ json: "webResponses", js: "webResponses", typ: u(undefined, a(r("ExternalPropertyFileReference"))) },
	], false),
	"ExternalPropertyFileReference": o([
		{ json: "guid", js: "guid", typ: u(undefined, "") },
		{ json: "itemCount", js: "itemCount", typ: u(undefined, 0) },
		{ json: "location", js: "location", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"SpecialLocations": o([
		{ json: "displayBase", js: "displayBase", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
	], false),
	"VersionControlDetails": o([
		{ json: "asOfTimeUtc", js: "asOfTimeUtc", typ: u(undefined, Date) },
		{ json: "branch", js: "branch", typ: u(undefined, "") },
		{ json: "mappedTo", js: "mappedTo", typ: u(undefined, r("ArtifactLocation")) },
		{ json: "properties", js: "properties", typ: u(undefined, r("PropertyBag")) },
		{ json: "repositoryUri", js: "repositoryUri", typ: "" },
		{ json: "revisionId", js: "revisionId", typ: u(undefined, "") },
		{ json: "revisionTag", js: "revisionTag", typ: u(undefined, "") },
	], false),
	"Role": [
		"added",
		"analysisTarget",
		"attachment",
		"debugOutputFile",
		"deleted",
		"directory",
		"driver",
		"extension",
		"memoryContents",
		"modified",
		"policy",
		"referencedOnCommandLine",
		"renamed",
		"responseFile",
		"resultFile",
		"standardStream",
		"taxonomy",
		"toolSpecifiedConfiguration",
		"tracedFile",
		"translation",
		"uncontrolled",
		"unmodified",
		"userSpecifiedConfiguration",
	],
	"Level": [
		"error",
		"none",
		"note",
		"warning",
	],
	"Content": [
		"localizedData",
		"nonLocalizedData",
	],
	"BaselineState": [
		"absent",
		"new",
		"unchanged",
		"updated",
	],
	"Importance": [
		"essential",
		"important",
		"unimportant",
	],
	"ResultKind": [
		"fail",
		"informational",
		"notApplicable",
		"open",
		"pass",
		"review",
	],
	"SuppressionKind": [
		"external",
		"inSource",
	],
	"Status": [
		"accepted",
		"rejected",
		"underReview",
	],
	"Version": [
		"2.1.0",
	],
	"ColumnKind": [
		"unicodeCodePoints",
		"utf16CodeUnits",
	],
};
